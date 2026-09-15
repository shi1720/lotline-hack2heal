// Compatibility interface for shared routes. Firebase never trusts Sites identity headers.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { firebaseAuth } from '@/lib/firebase/admin';
export type ChatGPTUser = { userId:string; isAnonymous:boolean; displayName:string; email:string; fullName:string|null };
export async function getChatGPTUser(): Promise<ChatGPTUser|null> {
  const session = (await cookies()).get('__session')?.value;
  if (!session) return null;
  try {
    const user = await firebaseAuth().verifySessionCookie(session, true);
    return {userId:user.uid, displayName:user.email || `Visitor ${user.uid.slice(0,8)}`, email:user.email || '', fullName:null, isAnonymous:user.firebase.sign_in_provider === 'anonymous'};
  } catch { return null; }
}
export async function requireChatGPTUser(_returnTo:string) {
  const user = await getChatGPTUser();
  if (!user) redirect('/signin');
  return user;
}
