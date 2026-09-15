'use client';
import { useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
export default function AccountMenu({label,guest}:{label:string;guest:boolean}) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function leave() {
    setBusy(true);setError('');
    try {
      const response = await fetch('/api/auth/session',{method:'DELETE'});
      if (!response.ok) throw new Error('Could not sign out. Please retry.');
      const config = await (await fetch('/api/auth/config')).json();
      await signOut(getAuth(getApps()[0] ?? initializeApp(config)));
      location.assign('/signin');
    } catch { setError('Sign-out could not finish. Retry.');setBusy(false); }
  }
  return <div className="account-menu"><span title={label}>{guest?'Guest demo':label}</span>{guest && <a href="/signin">Sign in</a>}<Button variant="outline" size="sm" disabled={busy} onClick={leave}>{busy?'Signing out…':'Sign out'}</Button>{error && <small role="alert">{error}</small>}</div>;
}
