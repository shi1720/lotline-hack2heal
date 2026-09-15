'use client';
import { useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, connectAuthEmulator, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
let emulatorConnected = false;
export default function SignIn() {
  const [mode,setMode] = useState<'signin'|'signup'|'reset'>('signin');
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [message,setMessage] = useState('');
  async function start(demo=false) {
    setBusy(true); setError(''); setMessage('');
    try {
      const configResponse = await fetch('/api/auth/config');
      if (!configResponse.ok) throw new Error('Sign-in is temporarily unavailable. Please try again.');
      const config = await configResponse.json();
      const auth = getAuth(getApps()[0] ?? initializeApp(config));
      if (config.emulator && !emulatorConnected && ['localhost','127.0.0.1'].includes(location.hostname)) {
        connectAuthEmulator(auth,`http://${config.emulator}`,{disableWarnings:true}); emulatorConnected = true;
      }
      await setPersistence(auth,browserLocalPersistence);
      if (!demo && mode === 'reset') {
        await sendPasswordResetEmail(auth,email,{url:location.origin+'/signin'});
        setMessage('If this email has an account, a password reset link is on its way.'); setBusy(false); return;
      }
      const credential = demo ? await signInAnonymously(auth) : mode === 'signup'
        ? await createUserWithEmailAndPassword(auth,email,password)
        : await signInWithEmailAndPassword(auth,email,password);
      const response = await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:await credential.user.getIdToken(true)})});
      if (!response.ok) throw new Error((await response.json()).error);
      location.replace(demo ? '/?scope=demo' : '/?scope=inventory');
    } catch(e) {
      const code = (e as {code?:string}).code;
      const messages:Record<string,string> = {'auth/invalid-credential':'The email or password is incorrect.', 'auth/email-already-in-use':'This email already has an account. Sign in or reset your password.', 'auth/weak-password':'Choose a stronger password of at least 8 characters.', 'auth/too-many-requests':'Too many attempts. Please wait a moment and retry.', 'auth/network-request-failed':'Check your connection and try again.'};
      setError(code ? messages[code] || 'Could not sign in. Check your details and try again.' : e instanceof Error ? e.message : 'Could not sign in. Please retry.');
      setBusy(false);
    }
  }
  return <main className="auth-screen"><section className="auth-card">
    <a className="auth-brand" href="/signin">lotline <span>Recall response</span></a>
    <h1>{mode === 'signup' ? 'Your stock. Your response record.' : mode === 'reset' ? 'Reset your password.' : 'Every unit needs an answer.'}</h1>
    <p className="auth-intro">{mode === 'reset' ? 'We’ll send a reset link to your account email.' : 'Sign in to import your inventory, review recall notices, and account for every affected unit.'}</p>
    <form className="auth-form" onSubmit={e=>{e.preventDefault();void start();}}>
      <label htmlFor="email">Email address</label><Input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
      {mode !== 'reset' && <><label htmlFor="password">Password</label><Input id="password" type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?8:1} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></>}
      <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : mode==='signup' ? 'Create account' : mode==='reset' ? 'Send reset link' : 'Sign in'}</Button>
    </form>
    {error && <p role="alert" className="error-box">{error}</p>}{message && <p role="status" className="success-box">{message}</p>}
    <div className="auth-links"><button disabled={busy} onClick={()=>{setMode(mode==='signup'?'signin':'signup');setError('');setMessage('');}}>{mode==='signup'?'Already have an account? Sign in':'Create an account'}</button><button disabled={busy} onClick={()=>{setMode(mode==='reset'?'signin':'reset');setError('');setMessage('');}}>{mode==='reset'?'Back to sign in':'Forgot password?'}</button></div>
    <div className="auth-demo"><p>Just exploring?</p><Button variant="outline" disabled={busy} onClick={()=>void start(true)}>Try the sample demo</Button><small>Separate fictional stock. No account details needed.</small></div>
    <p className="auth-note">For unused medical-device inventory. Do not enter patient information. Source review and physical actions remain your responsibility.</p>
  </section></main>;
}
