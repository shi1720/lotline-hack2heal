#!/usr/bin/env python3
"""Offline contract tests for Lotline's Cloud Shell deployer.

Run:
  LOTLINE_REPO=/absolute/path/to/lotline python3 tests/test_firebase_deploy.py

Only Python's standard library is required. All subprocess/network entry points
are blocked unless a test supplies an explicit mock. No cloud credentials needed.
"""
import copy
import gzip
import hashlib
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

REPO = Path(os.environ.get(
    "LOTLINE_REPO", Path(__file__).resolve().parents[1]
)).resolve()
sys.dont_write_bytecode = True
sys.path.insert(0, str(REPO / "deploy" / "firebase"))
deploy = importlib.import_module("deploy")

PROJECT = "lotline-test-project"
NUMBER = "123456789012"
HOSTING = "https://firebasehosting.googleapis.com/v1beta1/"
FIREBASE = "https://firebase.googleapis.com/v1beta1/"
IDENTITY = "https://identitytoolkit.googleapis.com/admin/v2/"


class OfflineTestCase(unittest.TestCase):
    def setUp(self):
        self.addCleanup(patch.stopall)
        patch("subprocess.run", side_effect=AssertionError("Unexpected subprocess")).start()
        patch("urllib.request.urlopen", side_effect=AssertionError("Unexpected network call")).start()
        patch.object(deploy, "log").start()
        patch.object(deploy.time, "sleep", side_effect=AssertionError("Unexpected wait")).start()


class SiteSelectionTests(OfflineTestCase):
    def google(self):
        google = Mock(spec=deploy.Google)
        google.optional.return_value = None
        google.request.return_value = {}
        return google

    def test_preferred_site_created(self):
        google = self.google()
        self.assertEqual(deploy.choose_site(google, PROJECT, NUMBER), "lotline")
        google.request.assert_called_once_with(
            "POST", HOSTING + f"projects/{PROJECT}/sites?siteId=lotline", {}
        )

    def test_owned_site_reused_without_creation(self):
        google = self.google()
        google.optional.return_value = {"name": f"projects/{PROJECT}/sites/lotline"}
        self.assertEqual(deploy.choose_site(google, PROJECT, NUMBER), "lotline")
        google.request.assert_not_called()

    def test_reserved_http400_uses_project_number_fallback(self):
        google = self.google()
        google.request.side_effect = [deploy.ApiError(400, "Site reserved by another project"), {}]
        self.assertEqual(deploy.choose_site(google, PROJECT, NUMBER), f"lotline-{NUMBER}")
        self.assertEqual(google.request.call_args.args[1],
                         HOSTING + f"projects/{PROJECT}/sites?siteId=lotline-{NUMBER}")

    def test_http409_collision_uses_fallback(self):
        google = self.google()
        google.request.side_effect = [deploy.ApiError(409, "Already exists"), {}]
        self.assertEqual(deploy.choose_site(google, PROJECT, NUMBER), f"lotline-{NUMBER}")

    def test_explicit_site_collision_never_silently_falls_back(self):
        google = self.google()
        google.request.side_effect = deploy.ApiError(409, "Already exists")
        with self.assertRaisesRegex(deploy.DeployError, "unavailable"):
            deploy.choose_site(google, PROJECT, NUMBER, "requested-site")
        self.assertEqual(google.request.call_count, 1)

    def test_permission_error_is_not_a_name_collision(self):
        google = self.google()
        google.request.side_effect = deploy.ApiError(403, "Permission denied")
        with self.assertRaises(deploy.ApiError) as caught:
            deploy.choose_site(google, PROJECT, NUMBER)
        self.assertEqual(caught.exception.status, 403)
        self.assertEqual(google.request.call_count, 1)

    def test_concurrent_creation_in_same_project_reuses_site(self):
        google = self.google()
        google.optional.side_effect = [None, {"name": f"projects/{PROJECT}/sites/lotline"}]
        google.request.side_effect = deploy.ApiError(409, "Already exists")
        self.assertEqual(deploy.choose_site(google, PROJECT, NUMBER), "lotline")
        self.assertEqual(google.request.call_count, 1)

    def test_exhausted_candidates_fail(self):
        google = self.google()
        google.request.side_effect = deploy.ApiError(409, "Already exists")
        with self.assertRaisesRegex(deploy.DeployError, "Both default site IDs"):
            deploy.choose_site(google, PROJECT, NUMBER)
        self.assertEqual(google.request.call_count, 2)

    def test_invalid_explicit_site_rejected_before_requests(self):
        google = self.google()
        with self.assertRaises(deploy.DeployError):
            deploy.choose_site(google, PROJECT, NUMBER, "https://wrong.example")
        google.optional.assert_not_called()
        google.request.assert_not_called()


class AuthConfigurationTests(OfflineTestCase):
    def run_auth(self, email):
        google = Mock(spec=deploy.Google)
        config = {"signIn": {"email": email},
                  "authorizedDomains": ["existing.example", "lotline.web.app"]}
        google.optional.return_value = copy.deepcopy(config)
        app_name = f"projects/{PROJECT}/webApps/1:123:web:abc"
        sdk = {"apiKey": "public-test-key", "projectId": PROJECT,
               "authDomain": PROJECT + ".firebaseapp.com", "appId": "1:123:web:abc"}

        def request(method, url, data=None, raw=False):
            if method == "PATCH" and url.startswith(IDENTITY + f"projects/{PROJECT}/config?"):
                return {}
            if method == "GET" and url == FIREBASE + f"projects/{PROJECT}/webApps?pageSize=100":
                return {"apps": [{"name": app_name, "displayName": "Lotline web"}]}
            if method == "GET" and url == FIREBASE + app_name + "/config":
                return sdk
            self.fail(f"Unexpected auth API request: {method} {url}")

        google.request.side_effect = request
        self.assertEqual(deploy.ensure_auth(google, PROJECT, "lotline"), sdk)
        calls = [call for call in google.request.call_args_list if call.args[0] == "PATCH"]
        self.assertEqual(len(calls), 1)
        method, url, body = calls[0].args
        return parse_qs(urlparse(url).query)["updateMask"][0].split(","), body, google

    def test_existing_email_link_false_is_preserved(self):
        mask, body, google = self.run_auth({"enabled": True, "passwordRequired": False})
        self.assertNotIn("signIn.email.passwordRequired", mask)
        self.assertNotIn("passwordRequired", body["signIn"]["email"])
        self.assertTrue(body["signIn"]["email"]["enabled"])
        self.assertTrue(body["signIn"]["anonymous"]["enabled"])
        google.operation.assert_not_called()

    def test_existing_password_provider_is_not_reconfigured(self):
        mask, body, _ = self.run_auth({"enabled": True, "passwordRequired": True})
        self.assertNotIn("signIn.email.passwordRequired", mask)
        self.assertNotIn("passwordRequired", body["signIn"]["email"])

    def test_new_email_provider_enables_password_signin(self):
        mask, body, _ = self.run_auth({"enabled": False})
        self.assertIn("signIn.email.passwordRequired", mask)
        self.assertEqual(body["signIn"]["email"], {"enabled": True, "passwordRequired": True})

    def test_domains_merged_and_deduplicated(self):
        _, body, _ = self.run_auth({"enabled": True, "passwordRequired": False})
        self.assertEqual(body["authorizedDomains"],
                         ["existing.example", "lotline.web.app", "lotline.firebaseapp.com"])


class HostingPublicationTests(OfflineTestCase):
    def publication(self, *, upload=True, unexpected_hash=False, final_status="FINALIZED"):
        google = Mock(spec=deploy.Google)
        version = "sites/lotline/versions/version-test"
        revision = "revision-fixture-123"
        calls = []
        declared_digest = None

        def request(method, url, data=None, raw=False):
            nonlocal declared_digest
            calls.append((method, url, copy.deepcopy(data), raw))
            if method == "POST" and url == HOSTING + "sites/lotline/versions":
                return {"name": version}
            if method == "POST" and url == HOSTING + version + ":populateFiles":
                self.assertEqual(set(data["files"]), {"/__lotline-deploy.json"})
                declared_digest = data["files"]["/__lotline-deploy.json"]
                hashes = ["unexpected"] if unexpected_hash else [declared_digest] if upload else []
                return {"uploadUrl": "https://upload-firebasehosting.googleapis.com/upload/test/files",
                        "uploadRequiredHashes": hashes}
            if method == "POST" and url.startswith("https://upload-firebasehosting.googleapis.com/"):
                self.assertTrue(raw)
                self.assertEqual(hashlib.sha256(data).hexdigest(), declared_digest)
                self.assertTrue(url.endswith("/" + declared_digest))
                self.assertEqual(json.loads(gzip.decompress(data)),
                                 {"product": "Lotline", "revision": revision})
                self.assertEqual(data[4:8], b"\x00\x00\x00\x00", "gzip timestamp must be deterministic")
                return {}
            if method == "PATCH" and url == HOSTING + version + "?updateMask=status":
                self.assertEqual(data, {"status": "FINALIZED"})
                return {"status": final_status}
            if method == "POST" and url.startswith(HOSTING + "sites/lotline/releases?"):
                self.assertEqual(parse_qs(urlparse(url).query), {"versionName": [version]})
                return {"name": "sites/lotline/releases/release-test"}
            self.fail(f"Unexpected Hosting request: {method} {url}")

        google.request.side_effect = request
        return google, calls, version, revision

    def test_rest_config_gzip_digest_upload_finalize_then_release(self):
        google, calls, version, revision = self.publication()
        self.assertEqual(deploy.publish_hosting(google, "lotline", revision), version)
        config = calls[0][2]["config"]
        self.assertEqual(config["rewrites"], [{"glob": "**", "run": {
            "serviceId": "lotline-web", "region": "us-central1"}}])
        self.assertEqual(config["headers"], [{"glob": "**", "headers": {
            "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}}])
        self.assertEqual([c[0] for c in calls], ["POST", "POST", "POST", "PATCH", "POST"])
        self.assertIn("/releases?", calls[-1][1])

    def test_existing_hash_does_not_upload_again(self):
        google, calls, _, revision = self.publication(upload=False)
        deploy.publish_hosting(google, "lotline", revision)
        self.assertFalse(any(raw for _, _, _, raw in calls))
        self.assertEqual(len(calls), 4)

    def test_unexpected_required_hash_blocks_publication(self):
        google, calls, _, revision = self.publication(unexpected_hash=True)
        with self.assertRaisesRegex(deploy.DeployError, "unexpected file hash"):
            deploy.publish_hosting(google, "lotline", revision)
        self.assertEqual(len(calls), 2)

    def test_unsuccessful_finalization_never_releases(self):
        google, calls, _, revision = self.publication(final_status="CREATED")
        with self.assertRaisesRegex(deploy.DeployError, "did not finalize"):
            deploy.publish_hosting(google, "lotline", revision)
        self.assertFalse(any("/releases?" in url for _, url, _, _ in calls))


class MainFlowTests(OfflineTestCase):
    def run_main(self, *, saved=None, explicit=None, billing=True):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        if saved is not None:
            (root / ".firebase-deploy-state.json").write_text(json.dumps(saved))
        patch.object(deploy, "ROOT", root).start()
        patch.dict(os.environ, {}, clear=True).start()
        argv = ["deploy.py", "--project", PROJECT]
        if explicit:
            argv += ["--site", explicit]
        patch.object(sys, "argv", argv).start()

        def cloud(*args, **kwargs):
            if args[:2] == ("auth", "list"):
                value = "deployer@example.invalid\n"
            elif args[:3] == ("billing", "projects", "describe"):
                value = json.dumps({"billingEnabled": billing})
            elif args[:2] == ("projects", "describe"):
                value = NUMBER
            elif args[:2] == ("services", "enable"):
                value = ""
            else:
                self.fail(f"Unexpected gcloud call: {args}")
            return subprocess.CompletedProcess(args, 0, value, "")

        patch.object(deploy, "cloud", side_effect=cloud).start()
        patch.object(deploy, "command", return_value=subprocess.CompletedProcess([], 0, "a" * 40, "")).start()
        google = patch.object(deploy, "Google", return_value=Mock()).start()
        chosen = []

        def choose(_google, project, number, requested=None):
            self.assertEqual((project, number), (PROJECT, NUMBER))
            chosen.append(requested)
            return requested or "lotline"

        patch.object(deploy, "choose_site", side_effect=choose).start()
        ensure_firebase = patch.object(deploy, "ensure_firebase").start()
        patch.object(deploy, "ensure_auth", return_value={"apiKey": "public"}).start()
        patch.object(deploy, "ensure_database").start()
        patch.object(deploy, "ensure_infrastructure", return_value=("runtime", "builder", "bucket")).start()
        patch.object(deploy, "build_and_run").start()
        publish = patch.object(deploy, "publish_hosting", return_value="sites/test/versions/v").start()
        patch.object(deploy, "smoke").start()
        if not billing:
            with self.assertRaisesRegex(deploy.DeployError, "Billing must already be enabled"):
                deploy.main()
            google.assert_not_called()
            ensure_firebase.assert_not_called()
            self.assertEqual(chosen, [])
            return chosen, None, publish
        deploy.main()
        state = json.loads((root / ".firebase-deploy-state.json").read_text())
        return chosen, state, publish

    def test_fresh_flow_ensures_project_auth_site_before_app_site(self):
        chosen, state, publish = self.run_main()
        self.assertEqual(chosen, [PROJECT, None])
        self.assertEqual(state["site"], "lotline")
        self.assertEqual(publish.call_args.args[1], "lotline", "Do not publish over default auth site")

    def test_same_project_saved_site_is_reused(self):
        chosen, state, _ = self.run_main(saved={"project": PROJECT, "site": "lotline-123456789012"})
        self.assertEqual(chosen, [PROJECT, "lotline-123456789012"])
        self.assertEqual(state["site"], "lotline-123456789012")

    def test_other_project_state_is_ignored(self):
        chosen, state, _ = self.run_main(saved={"project": "unrelated-project", "site": "unrelated-site"})
        self.assertEqual(chosen, [PROJECT, None])
        self.assertEqual(state["project"], PROJECT)

    def test_explicit_site_overrides_saved_site(self):
        chosen, state, _ = self.run_main(saved={"project": PROJECT, "site": "old-lotline"}, explicit="new-lotline")
        self.assertEqual(chosen, [PROJECT, "new-lotline"])
        self.assertEqual(state["site"], "new-lotline")

    def test_missing_billing_stops_before_any_provisioning(self):
        self.run_main(billing=False)


class InfrastructureTests(OfflineTestCase):
    def test_runtime_is_database_scoped_and_builder_gets_source_bucket_read(self):
        calls = []

        def cloud(*args, **kwargs):
            calls.append(args)
            return subprocess.CompletedProcess(args, 0, "{}", "")

        patch.object(deploy, "cloud", side_effect=cloud).start()
        runtime, builder, bucket = deploy.ensure_infrastructure(PROJECT)
        datastore = [args for args in calls if "roles/datastore.user" in args]
        self.assertEqual(len(datastore), 1)
        self.assertIn(f"serviceAccount:{runtime}", datastore[0])
        self.assertIn(f'expression=resource.name=="projects/{PROJECT}/databases/lotline",title=LotlineDatabase', datastore[0])
        readers = [args for args in calls if "roles/storage.objectViewer" in args]
        self.assertEqual(len(readers), 1)
        self.assertIn(bucket, readers[0])
        self.assertIn(f"serviceAccount:{builder}", readers[0])
        self.assertTrue(any("roles/artifactregistry.writer" in args and f"serviceAccount:{builder}" in args for args in calls))
        self.assertTrue(any("roles/logging.logWriter" in args and f"serviceAccount:{builder}" in args for args in calls))
        self.assertFalse(any("roles/editor" in args or "roles/owner" in args for args in calls))


class ProvisionRetryTests(OfflineTestCase):
    def test_reconciles_after_uncertain_server_failure(self):
        action = Mock(side_effect=[deploy.ApiError(502,"temporary"),{"ready":True}])
        with patch.object(deploy.time,"sleep"):
            self.assertEqual(deploy.provision(action),{"ready":True})
        self.assertEqual(action.call_count,2)

    def test_permission_failure_is_not_blindly_retried(self):
        action = Mock(side_effect=deploy.ApiError(403,"permission denied"))
        with self.assertRaises(deploy.ApiError): deploy.provision(action)
        self.assertEqual(action.call_count,1)

    def test_retry_budget_is_bounded(self):
        action = Mock(side_effect=deploy.ApiError(503,"temporary"))
        with patch.object(deploy.time,"sleep"), self.assertRaises(deploy.ApiError):
            deploy.provision(action)
        self.assertEqual(action.call_count,5)


class CredentialHeadersTests(OfflineTestCase):
    def test_user_credentials_include_selected_quota_project(self):
        google = deploy.Google(PROJECT)
        google.token = "synthetic-test-token"
        google.token_at = deploy.time.monotonic()
        response = Mock()
        response.read.return_value = b"{}"
        opened = Mock()
        opened.__enter__ = Mock(return_value=response)
        opened.__exit__ = Mock(return_value=False)
        with patch.object(deploy.urllib.request, "urlopen", return_value=opened) as send:
            google.request("GET", IDENTITY + f"projects/{PROJECT}/config")
        request = send.call_args.args[0]
        self.assertEqual(request.get_header("X-goog-user-project"), PROJECT)
        self.assertEqual(request.get_header("Authorization"), "Bearer synthetic-test-token")


if __name__ == "__main__":
    unittest.main(verbosity=2)
