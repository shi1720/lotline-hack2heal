/** Run only under the Firebase emulator executor; never against a hosted account. */
import {spawn} from 'node:child_process';
import {cp,mkdir} from 'node:fs/promises';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9199'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8180') throw new Error('Run through the documented Firebase emulator command.');
const root='.firebase-build/app';
await cp(root+'/public',root+'/.next/standalone/public',{recursive:true});
await mkdir(root+'/.next/standalone/.next',{recursive:true});await cp(root+'/.next/static',root+'/.next/standalone/.next/static',{recursive:true});
const env={...process.env,GOOGLE_CLOUD_PROJECT:'demo-lotline',FIRESTORE_DATABASE_ID:'lotline',APP_ORIGIN:'http://127.0.0.1:8080',FIREBASE_WEB_API_KEY:'fake-api-key',FIREBASE_AUTH_DOMAIN:'demo-lotline.firebaseapp.com',FIREBASE_WEB_APP_ID:'demo-app',PORT:'8080',HOSTNAME:'127.0.0.1',LOTLINE_TEST_URL:'http://127.0.0.1:8080',LOTLINE_TEST_FIREBASE:'1'};
const server=spawn(process.execPath,[root+'/.next/standalone/server.js'],{env,stdio:'inherit'});
const run=file=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file],{env,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(file+' failed with '+code)));});
try{
 let ready=false;
 for(let i=0;i<60;i++){try{if((await fetch(env.APP_ORIGIN+'/api/health')).ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw new Error('Local server did not start.');
 await run('tests/e2e.mjs');await run('tests/firebase-accounts.mjs');
}finally{server.kill('SIGTERM');}
