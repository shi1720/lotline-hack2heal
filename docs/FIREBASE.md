# Deploy Lotline to Firebase

One command deploys the complete web application from a checkout in Google Cloud Shell. Firebase Hosting serves HTTPS, Cloud Run runs the backend, Firebase Authentication manages accounts, and a named Firestore database stores workspaces.

## Before you run it

- Open **Google Cloud Shell** and sign in with the account that should deploy the service. `gcloud`, Python 3, and Git must be available.
- Select the intended Google Cloud project and enable billing for it. The deployer checks billing; it does not create a project or attach a billing account.
- Use an account with project Owner permissions for initial setup, or have an administrator provide equivalent deployment permissions. Initial setup enables APIs, adds Firebase, configures Authentication and Hosting, creates a database and service accounts, changes IAM, and creates Cloud Build, Artifact Registry, storage, and Cloud Run resources. Ordinary app-user access is insufficient. Organization policies may require an administrator even when the account is a project owner.
- Check for existing resources named `lotline`, `lotline-web`, `lotline-runtime`, and `lotline-builder`. These names are reserved for this deployment. The script reuses matching resources; do not point it at unrelated resources with those names.

Confirm the active account and project if needed:

```sh
gcloud auth list --filter=status:ACTIVE
gcloud config get-value project
```

## Deploy

Without a checkout:

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/shi1720/lotline-hack2heal/main/scripts/deploy-firebase.sh)
```

From the repository root:

```sh
bash scripts/deploy-firebase.sh
```

An explicit project takes precedence over the active `gcloud` project:

```sh
bash scripts/deploy-firebase.sh --project YOUR_PROJECT_ID
```

To request a particular available Firebase Hosting site ID:

```sh
bash scripts/deploy-firebase.sh --project YOUR_PROJECT_ID --site YOUR_SITE_ID
```

Equivalent environment variables are `LOTLINE_PROJECT_ID` and `LOTLINE_SITE_ID`. With no requested site, the deployer tries `lotline`, then `lotline-PROJECT_NUMBER`. It prints the actual `https://SITE_ID.web.app` address. Global name availability determines which address can be used.

No separate Firebase CLI login, downloaded service-account key, or local Docker is required. Google Cloud Shell's active credentials authorize setup. The app uses a dedicated runtime service account.

## What the command changes

| Resource | Configuration |
|---|---|
| Firebase Hosting | Selected site; HTTPS requests rewrite to Cloud Run |
| Firebase Authentication | Anonymous demo and email/password accounts; password reset through Firebase |
| Firestore | Named `lotline` database, Native mode, `us-central1`, deletion protection when created |
| Browser database access | Denied by Firestore rules; the IAM-authenticated backend owns access |
| Cloud Run | `lotline-web` in `us-central1`; 1 CPU, 512 MiB, 60-second timeout, concurrency 20 |
| Scaling | Minimum 0 instances, maximum 2 instances |
| Service accounts | `lotline-runtime` and `lotline-builder` |
| Image repository | Artifact Registry repository `lotline` in `us-central1` |
| Build source | Bucket `PROJECT_ID-lotline-build-source` |
| Local deployment metadata | Ignored `.firebase-deploy-state.json` and `.firebase-build/` |

The deployer creates a standalone build from the application directories and Firebase adapters. It does not copy root environment files or downloaded credential files into the build. Cloud Build produces the container; Cloud Run uses Application Default Credentials from its attached service account.

The `lotline` database is separate from `(default)`. This avoids replacing default-database rules. The deployer updates rules for `lotline`, so that database must be dedicated to Lotline.

## Verify the result

Wait for **Deployment complete** and the printed URL. The automated checks create a disposable anonymous visitor, verify a synthetic label update persists, inspect the evidence export, and confirm forged legacy identity headers are rejected. The script then attempts to remove only that temporary identity and its temporary workspace.

After deployment, check the registered account flow as well:

1. Create an email/password account and sign out.
2. Sign in again and test password reset.
3. Confirm the demo is available and the separate inventory workspace starts empty.
4. Import authorized nonpatient inventory into the inventory workspace. Refresh and confirm persistence.
5. Switch to the demo and back. Neither workspace should change because of switching.
6. Check the phone layout and evidence export.

A working anonymous smoke test does not by itself verify email delivery, registered-account recovery, or separation of the two workspace modes.

## Costs and operating limits

Billing must be enabled. This is **not** a guaranteed-free deployment. Usage can incur charges for Cloud Run, Cloud Build, Artifact Registry, Firestore, storage, Hosting, logging, and Authentication as applicable to the project and its usage.

Zero minimum instances allows the backend to scale down when idle. Two maximum instances limits service scaling; it is not a total spending cap and does not cap database, build, storage, logging, or Hosting costs. Review project usage and configure billing alerts before sharing the service widely.

Firestore free-quota eligibility is project-dependent. Do not assume the named `lotline` database is free because another database or service advertises a free allowance. Review the current [Firestore billing documentation](https://firebase.google.com/docs/firestore/pricing) and the project's usage before estimating cost.

## Deploy updates

Update the checkout and rerun the same command with the same project and site. Reusing the same project preserves the database and registered identities; review any application data migration before deploying it. The script does not intentionally reset existing workspaces during an update.

A failed smoke check may happen after the new Cloud Run revision or Hosting version is already published. Failure is not a rollback. Read the error and logs, correct the issue, and redeploy. Avoid restarting with another project merely to bypass a setup error.

## Troubleshooting

| Message or symptom | What to check |
|---|---|
| Missing tool / no active account | Run from signed-in Google Cloud Shell |
| Invalid or missing project | Select a real project ID or pass `--project` |
| Billing disabled | Enable billing on that selected project, then rerun |
| Permission denied | Have the project administrator review setup IAM and organization policies |
| Preferred address unavailable | Allow the project-number fallback, or choose an available `--site` |
| Cloud Build failure | Open the build log printed by `gcloud`; fix the failing dependency or application build |
| Sign-in unavailable | Confirm the Firebase web configuration, auth provider settings, and authorized Hosting domain |
| Database unavailable | Confirm `lotline` is Native mode and the runtime account has access to that named database |
| Hosting has not reached the backend | Inspect the `lotline-web` Cloud Run revision and Hosting rewrite in `us-central1` |
| Smoke cleanup warning | Inspect only the disposable test identity/document identified by the run; other user records must not be removed |

The app's canonical origin is the printed `.web.app` URL. Adding a custom domain also requires updating the app origin and auth-domain configuration; merely adding a Hosting alias is not a complete setup change.
