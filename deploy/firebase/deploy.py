#!/usr/bin/env python3
"""Deploy Lotline from Google Cloud Shell using gcloud + documented Google REST APIs.
No Firebase CLI login, downloaded service-account key, or local Docker is needed.
"""
import argparse
import gzip
import hashlib
import http.cookiejar
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from stage import ROOT, stage

REGION = 'us-central1'  # Supported by Firebase Hosting's Cloud Run integration.
DATABASE = 'lotline'
SERVICE = 'lotline-web'
FIREBASE = 'https://firebase.googleapis.com/v1beta1/'
HOSTING = 'https://firebasehosting.googleapis.com/v1beta1/'
FIRESTORE = 'https://firestore.googleapis.com/v1/'
RULES = 'https://firebaserules.googleapis.com/v1/'
IDENTITY = 'https://identitytoolkit.googleapis.com/admin/v2/'
APIS = ('firebase.googleapis.com','firebasehosting.googleapis.com','firebaserules.googleapis.com',
        'firestore.googleapis.com','identitytoolkit.googleapis.com','run.googleapis.com',
        'cloudbuild.googleapis.com','artifactregistry.googleapis.com','iam.googleapis.com',
        'logging.googleapis.com','storage.googleapis.com','serviceusage.googleapis.com')

class DeployError(Exception):
    pass

class ApiError(DeployError):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(f'Google API {status}: {message}')

def log(message):
    print(f'\n[Lotline] {message}', flush=True)

def command(*args, capture=True, check=True):
    result = subprocess.run(list(args), text=True, stdout=subprocess.PIPE if capture else None,
                            stderr=subprocess.PIPE if capture else None)
    if check and result.returncode:
        detail = (result.stderr or '').strip()
        raise DeployError(f'{args[0]} {args[1] if len(args)>1 else ""} failed. {detail}')
    return result

def cloud(*args, **kwargs):
    return command('gcloud', *args, **kwargs)

class Google:
    def __init__(self, project=None):
        self.project = project
        self.token = None
        self.token_at = 0

    def request(self, method, url, data=None, raw=False):
        for attempt in range(6):
            try:
                return self._request(method,url,data,raw)
            except ApiError as error:
                # Retry idempotent calls and API-enablement propagation only.
                propagation = error.status == 403 and any(s in error.message.lower() for s in ('has not been used','service_disabled','api has not been enabled'))
                transient = method in ('GET','PATCH') and error.status in (429,500,502,503,504)
                if attempt == 5 or not (propagation or transient): raise
                log('Waiting for Google provisioning or a transient API failure…')
                time.sleep(min(2**attempt,16))

    def _request(self, method, url, data=None, raw=False):
        # Do not persist or print the access token. Refresh during long builds.
        if not self.token or time.monotonic() - self.token_at > 2400:
            self.token = cloud('auth','print-access-token').stdout.strip()
            self.token_at = time.monotonic()
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.googleapis.com'):
            raise DeployError('Refusing to send a Google credential to an unexpected host.')
        payload = data if raw else (json.dumps(data).encode() if data is not None else None)
        headers = {'Authorization':'Bearer '+self.token,
                   'Content-Type':'application/octet-stream' if raw else 'application/json'}
        if self.project: headers['X-Goog-User-Project'] = self.project
        request = urllib.request.Request(url, data=payload, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
                if not body or raw: return {}
                return json.loads(body)
        except urllib.error.HTTPError as error:
            body = error.read().decode(errors='replace')
            try: message = json.loads(body).get('error',{}).get('message',body)
            except (ValueError, AttributeError): message = body[:1000]
            raise ApiError(error.code, str(message)) from None

    def optional(self, url):
        try: return self.request('GET',url)
        except ApiError as error:
            if error.status == 404: return None
            raise

    def operation(self, base, operation, timeout=600):
        if 'name' not in operation: raise DeployError('Google did not return an operation name.')
        until = time.monotonic() + timeout
        next_progress = time.monotonic() + 30
        while not operation.get('done'):
            if time.monotonic() >= until:
                raise DeployError(f'Operation timed out: {operation["name"]}. Rerun after it completes.')
            time.sleep(3)
            operation = self.request('GET',base+operation['name'])
            if time.monotonic() >= next_progress:
                log('Google is still provisioning the requested resource…')
                next_progress = time.monotonic()+30
        if operation.get('error'): raise DeployError(str(operation['error']))
        return operation.get('response',{})

def choose_site(google, project, number, requested=None):
    candidates = [requested] if requested else ['lotline',f'lotline-{number}']
    for site in candidates:
        if not re.fullmatch(r'[a-z][a-z0-9-]{2,28}[a-z0-9]',site or ''):
            raise DeployError('Hosting site ID must be 4–30 lowercase letters, digits or hyphens.')
        url = HOSTING+f'projects/{project}/sites/{site}'
        if google.optional(url): return site
        try:
            google.request('POST',HOSTING+f'projects/{project}/sites?siteId={site}',{})
            return site
        except ApiError as error:
            collision = error.status == 409 or (error.status == 400 and any(
                word in error.message.lower() for word in ('reserved','already exists','already in use','unavailable')))
            if not collision: raise
            # A concurrent invocation might have created this site in our own project.
            if google.optional(url): return site
            if requested: raise DeployError(f'{site}.web.app is unavailable. Choose a different LOTLINE_SITE_ID.')
            log(f'{site}.web.app is unavailable; trying the project-specific address.')
    raise DeployError('Both default site IDs are unavailable. Set LOTLINE_SITE_ID to a unique name.')

def ensure_firebase(google, project):
    if not google.optional(FIREBASE+f'projects/{project}'):
        google.operation(FIREBASE,google.request('POST',FIREBASE+f'projects/{project}:addFirebase',{}))

def ensure_auth(google, project, site):
    url = IDENTITY+f'projects/{project}/config'
    config = google.optional(url)
    if config is None:
        google.request('POST','https://identitytoolkit.googleapis.com/v2/'+f'projects/{project}/identityPlatform:initializeAuth',{})
        config = google.request('GET',url)
    domains = list(dict.fromkeys(config.get('authorizedDomains',[]) +
                                [site+'.web.app',site+'.firebaseapp.com']))
    email = config.get('signIn',{}).get('email',{})
    updates = {'enabled':True}
    mask = 'signIn.anonymous.enabled,signIn.email.enabled,authorizedDomains'
    if not email.get('enabled'):
        updates['passwordRequired'] = True
        mask += ',signIn.email.passwordRequired'
    google.request('PATCH',url+'?updateMask='+mask,
                   {'signIn':{'anonymous':{'enabled':True},'email':updates},'authorizedDomains':domains})
    # Reuse the app created by this deployer, not an arbitrary pre-existing application.
    apps = google.request('GET',FIREBASE+f'projects/{project}/webApps?pageSize=100').get('apps',[])
    app = next((a for a in apps if a.get('displayName') == 'Lotline web'), None)
    if app is None:
        google.operation(FIREBASE, google.request('POST',FIREBASE+f'projects/{project}/webApps',{'displayName':'Lotline web'}))
        apps = google.request('GET',FIREBASE+f'projects/{project}/webApps?pageSize=100').get('apps',[])
        app = next((a for a in apps if a.get('displayName') == 'Lotline web'),None)
    if app is None: raise DeployError('The Firebase web app could not be found after creation.')
    return google.request('GET',FIREBASE+app['name']+'/config')

def ensure_database(google, project):
    name = f'projects/{project}/databases/{DATABASE}'
    database = google.optional(FIRESTORE+name)
    if database is None:
        google.operation(FIRESTORE, google.request('POST',FIRESTORE+f'projects/{project}/databases?databaseId={DATABASE}',
                         {'locationId':REGION,'type':'FIRESTORE_NATIVE','deleteProtectionState':'DELETE_PROTECTION_ENABLED'}))
    elif database.get('type') != 'FIRESTORE_NATIVE':
        raise DeployError('The existing lotline database is not Firestore Native. It will not be altered.')
    source = (ROOT/'deploy/firebase/firestore.rules').read_text()
    ruleset = google.request('POST',RULES+f'projects/{project}/rulesets',
                            {'source':{'files':[{'name':'firestore.rules','content':source}]}})
    release_name = f'projects/{project}/releases/cloud.firestore/{DATABASE}'
    release = {'name':release_name,'rulesetName':ruleset['name']}
    if google.optional(RULES+release_name):
        google.request('PATCH',RULES+release_name,{'release':release,'updateMask':'rulesetName'})
    else:
        google.request('POST',RULES+f'projects/{project}/releases',release)
    field = name+'/collectionGroups/lotline_workspaces/fields/state'
    operation = google.request('PATCH',FIRESTORE+field+'?updateMask=indexConfig',
                               {'name':field,'indexConfig':{'indexes':[]}})
    if operation.get('name'): google.operation(FIRESTORE,operation)

def ensure_account(project, account):
    email = f'{account}@{project}.iam.gserviceaccount.com'
    result = cloud('iam','service-accounts','describe',email,'--project',project,'--format=json',check=False)
    if result.returncode:
        cloud('iam','service-accounts','create',account,'--project',project,'--display-name',account,'--quiet')
    return email

def ensure_infrastructure(project):
    runtime = ensure_account(project,'lotline-runtime')
    builder = ensure_account(project,'lotline-builder')
    condition = f'expression=resource.name=="projects/{project}/databases/{DATABASE}",title=LotlineDatabase'
    cloud('projects','add-iam-policy-binding',project,'--member',f'serviceAccount:{runtime}',
          '--role','roles/datastore.user','--condition',condition,'--quiet')
    permissions = 'firebaseauth.users.createSession,firebaseauth.users.get'
    role_exists = cloud('iam','roles','describe','lotlineSession','--project',project,'--format=json',check=False).returncode == 0
    cloud('iam','roles','update' if role_exists else 'create','lotlineSession','--project',project,
          '--title','Lotline session verification','--permissions',permissions,'--stage','GA','--quiet')
    cloud('projects','add-iam-policy-binding',project,'--member',f'serviceAccount:{runtime}',
          '--role',f'projects/{project}/roles/lotlineSession','--condition=None','--quiet')
    cloud('projects','add-iam-policy-binding',project,'--member',f'serviceAccount:{builder}',
          '--role','roles/logging.logWriter','--condition=None','--quiet')
    repo = cloud('artifacts','repositories','describe','lotline','--location',REGION,'--project',project,'--format=json',check=False)
    if repo.returncode:
        cloud('artifacts','repositories','create','lotline','--repository-format=docker','--location',REGION,'--project',project,'--quiet')
    cloud('artifacts','repositories','add-iam-policy-binding','lotline','--location',REGION,'--project',project,
          '--member',f'serviceAccount:{builder}','--role','roles/artifactregistry.writer','--quiet')
    bucket = f'gs://{project}-lotline-build-source'
    if cloud('storage','buckets','describe',bucket,'--project',project,'--format=json',check=False).returncode:
        cloud('storage','buckets','create',bucket,'--location',REGION,'--project',project,
              '--uniform-bucket-level-access','--public-access-prevention','--quiet')
    cloud('storage','buckets','add-iam-policy-binding',bucket,'--member',f'serviceAccount:{builder}',
          '--role','roles/storage.objectViewer','--quiet')
    return runtime,builder,bucket

def build_and_run(project, site, sdk, runtime, builder, bucket, revision):
    build_parent = ROOT/'.firebase-build'
    build_parent.mkdir(exist_ok=True)
    context = stage(tempfile.mkdtemp(prefix='deploy-',dir=build_parent))
    image = f'{REGION}-docker.pkg.dev/{project}/lotline/web:{revision[:12]}-{int(time.time())}'
    build_config = {'steps':[{'name':'gcr.io/cloud-builders/docker','args':['build','-t',image,'.']}],
                    'images':[image], 'timeout':'1200s','options':{'logging':'CLOUD_LOGGING_ONLY'}}
    (context/'cloudbuild.json').write_text(json.dumps(build_config))
    log('Building the complete application in Cloud Build. This normally takes several minutes.')
    cloud('builds','submit',str(context),'--project',project,'--region',REGION,
          '--config',str(context/'cloudbuild.json'),'--service-account',f'projects/{project}/serviceAccounts/{builder}',
          '--gcs-source-staging-dir',bucket+'/source','--quiet',capture=False)
    # This JSON is valid YAML for gcloud. Firebase web configuration is public, not a credential.
    environment = {'GOOGLE_CLOUD_PROJECT':project,'FIRESTORE_DATABASE_ID':DATABASE,
                   'APP_ORIGIN':f'https://{site}.web.app','FIREBASE_WEB_API_KEY':sdk['apiKey'],
                   'FIREBASE_AUTH_DOMAIN':sdk['authDomain'],'FIREBASE_WEB_APP_ID':sdk['appId'],
                   'LOTLINE_REVISION':revision}
    env_file = context/'runtime-env.json'
    env_file.write_text(json.dumps(environment))
    log('Deploying the backend with a dedicated runtime identity and a two-instance limit.')
    cloud('run','deploy',SERVICE,'--project',project,'--region',REGION,'--image',image,
          '--service-account',runtime,'--allow-unauthenticated','--ingress=all','--port=8080',
          '--memory=512Mi','--cpu=1','--min-instances=0','--max-instances=2','--concurrency=20',
          '--timeout=60','--env-vars-file',str(env_file),'--quiet',capture=False)

def publish_hosting(google,site,revision):
    config = {'rewrites':[{'glob':'**','run':{'serviceId':SERVICE,'region':REGION}}],
              'headers':[{'glob':'**','headers':{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}]}
    version = google.request('POST',HOSTING+f'sites/{site}/versions',{'config':config})['name']
    payload = gzip.compress((json.dumps({'product':'Lotline','revision':revision})+'\n').encode(),mtime=0)
    digest = hashlib.sha256(payload).hexdigest()
    populated = google.request('POST',HOSTING+version+':populateFiles',{'files':{'/__lotline-deploy.json':digest}})
    for required in populated.get('uploadRequiredHashes',[]):
        if required != digest: raise DeployError('Hosting requested an unexpected file hash.')
        google.request('POST',populated['uploadUrl']+'/'+required,payload,raw=True)
    finalized = google.request('PATCH',HOSTING+version+'?updateMask=status',{'status':'FINALIZED'})
    if finalized.get('status') != 'FINALIZED': raise DeployError('Hosting version did not finalize.')
    google.request('POST',HOSTING+f'sites/{site}/releases?'+urllib.parse.urlencode({'versionName':version}),
                   {'message':'Lotline '+revision})
    return version

def public_request(url,data=None,headers=None,opener=None):
    request = urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,
                                    headers={'Content-Type':'application/json',**(headers or {})})
    open_request = opener.open if opener else urllib.request.urlopen
    with open_request(request,timeout=60) as response:
        return json.loads(response.read())

def smoke(google,project,site,sdk,revision):
    base = f'https://{site}.web.app'
    log('Checking the live URL, anonymous sign-in, saved inventory, and evidence export.')
    for attempt in range(30):
        try:
            health = public_request(base+'/api/health')
            if health.get('revision') == revision: break
        except (urllib.error.URLError,ValueError): pass
        time.sleep(4)
    else: raise DeployError('Hosting has not reached the new backend. Inspect Cloud Run logs and rerun.')
    user = None
    try:
        user = public_request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+sdk['apiKey'],{'returnSecureToken':True})
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        public_request(base+'/api/auth/session',{'idToken':user['idToken']},{'Origin':base},opener)
        first = public_request(base+'/api/workspace',opener=opener)
        if first['revision'] != 0: raise DeployError('Fresh visitor did not receive a fresh workspace.')
        action = {'type':'verify','stockId':'STK-003','lot':'SY2608-A','catalog':'LL-SYR-10',
                  'manufacturer':'Northstar Medical (fictional)','gtin':'','evidence':'Synthetic Firebase deployment smoke test; no physical action.'}
        public_request(base+'/api/workspace',{'revision':0,'requestId':str(uuid.uuid4()),'action':action},{'Origin':base},opener)
        saved = public_request(base+'/api/workspace',opener=opener)
        if saved['revision'] != 1: raise DeployError('The live database did not persist the action.')
        recall = saved['workspace']['recalls'][0]['id']
        exported = public_request(base+'/api/export?'+urllib.parse.urlencode({'recall':recall}),opener=opener)
        if exported['packet']['summary']['affected'] != 76: raise DeployError('Live export reconciliation failed.')
        # The protected API must reject forged Sites identity headers on Firebase.
        try:
            public_request(base+'/api/workspace',headers={'oai-authenticated-user-id':user['localId'],'oai-authenticated-user-email':'fake@example.invalid'})
        except urllib.error.HTTPError as error:
            if error.code != 401: raise
        else: raise DeployError('Unauthenticated API unexpectedly accepted a forged identity.')
    finally:
        if user:
            # Remove only the identity and document this function just created.
            try:
                public_request('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+sdk['apiKey'],{'idToken':user['idToken']})
                owner = hashlib.sha256(user['localId'].encode()).hexdigest()
                google.request('DELETE',FIRESTORE+f'projects/{project}/databases/{DATABASE}/documents/lotline_workspaces/{owner}')
            except Exception:
                log('The disposable smoke-test visitor could not be fully cleaned up; other workspaces were not touched.')
    log('Live sign-in, persistence, reconciliation, export and authentication checks passed.')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project',default=os.environ.get('LOTLINE_PROJECT_ID'))
    parser.add_argument('--site',default=os.environ.get('LOTLINE_SITE_ID'))
    args = parser.parse_args()
    project = args.project or cloud('config','get-value','project').stdout.strip()
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,28}[a-z0-9]',project or ''):
        raise DeployError('Select a billing-enabled project in Google Cloud Shell, then rerun this same command. Or set LOTLINE_PROJECT_ID.')
    account = cloud('auth','list','--filter=status:ACTIVE','--format=value(account)').stdout.strip()
    if not account: raise DeployError('Sign in to Google Cloud Shell, then run the command again.')
    billing = json.loads(cloud('billing','projects','describe',project,'--format=json').stdout)
    if not billing.get('billingEnabled'):
        raise DeployError(f'Billing must already be enabled: https://console.cloud.google.com/billing/linkedaccount?project={project}. No billing account was attached automatically.')
    number = cloud('projects','describe',project,'--format=value(projectNumber)').stdout.strip()
    revision = command('git','-C',str(ROOT),'rev-parse','HEAD').stdout.strip() + '-' + uuid.uuid4().hex[:8]
    log(f'Using project {project}. Provisioning Firebase Hosting, Auth, a dedicated Firestore database, Cloud Build and Cloud Run. Usage can incur charges.')
    cloud('services','enable',*APIS,'--project',project,'--quiet',capture=False)
    google = Google(project)
    ensure_firebase(google,project)
    # Provision the default reserved auth handler before a custom Hosting site.
    # Never publish over the default site's existing release.
    choose_site(google,project,number,project)
    saved_path = ROOT/'.firebase-deploy-state.json'
    saved = json.loads(saved_path.read_text()) if saved_path.exists() else {}
    saved_site = saved.get('site') if saved.get('project') == project else None
    site = choose_site(google,project,number,args.site or saved_site)
    log(f'Hosting address: https://{site}.web.app')
    (ROOT/'.firebase-deploy-state.json').write_text(json.dumps({'project':project,'site':site,'revision':revision},indent=2))
    sdk = ensure_auth(google,project,site)
    ensure_database(google,project)
    runtime,builder,bucket = ensure_infrastructure(project)
    build_and_run(project,site,sdk,runtime,builder,bucket,revision)
    log('Publishing the Firebase HTTPS address.')
    version = publish_hosting(google,site,revision)
    smoke(google,project,site,sdk,revision)
    log(f'Deployment complete: https://{site}.web.app\nProject: {project}\nHosting version: {version}\nRun this same command again to deploy updates.')

if __name__ == '__main__':
    try: main()
    except (DeployError, urllib.error.URLError, KeyError, ValueError) as error:
        print(f'\n[Lotline] Deployment stopped: {error}\nFix the reported prerequisite and rerun. Existing user workspaces are preserved.',file=sys.stderr)
        sys.exit(1)
