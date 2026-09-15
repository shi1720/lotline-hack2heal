import { cookies } from 'next/headers';
import { firebaseAuth } from '@/lib/firebase/admin';
import { DomainError } from '@/lib/lotline/domain';
import { readBody } from '@/lib/lotline/request';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'private, no-store'};
export async function POST(request:Request) {
  if (!process.env.APP_ORIGIN || request.headers.get('origin') !== process.env.APP_ORIGIN) {
    return Response.json({error:'Open this form on the Lotline website.'},{status:403,headers});
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({error:'Use JSON.'},{status:415,headers});
  try {
    const {idToken} = JSON.parse(await readBody(request, 16_000));
    if (typeof idToken !== 'string' || idToken.length > 12_000) throw new Error('Invalid token');
    const user = await firebaseAuth().verifyIdToken(idToken);
    const signedInAt = user.firebase.sign_in_provider === 'anonymous' ? user.iat : user.auth_time;
    if (signedInAt < Date.now()/1000 - 300) return Response.json({error:'Please sign in again to start a session.'},{status:401,headers});
    const expiresIn = 5*24*60*60*1000;
    const session = await firebaseAuth().createSessionCookie(idToken,{expiresIn});
    (await cookies()).set('__session',session,{httpOnly:true, secure:process.env.APP_ORIGIN.startsWith('https://'), sameSite:'lax', path:'/', maxAge:expiresIn/1000});
    return Response.json({ok:true},{headers});
  } catch (error) {
    if (error instanceof DomainError) return Response.json({error:error.message},{status:error.status,headers});
    return Response.json({error:'Could not start the session. Please retry sign-in.'},{status:401,headers});
  }
}

export async function DELETE(request:Request) {
  if (request.headers.get('origin') !== process.env.APP_ORIGIN) return Response.json({error:'Invalid origin.'},{status:403,headers});
  (await cookies()).set('__session','',{httpOnly:true,secure:process.env.APP_ORIGIN?.startsWith('https://'),sameSite:'lax',path:'/',maxAge:0});
  return Response.json({ok:true},{headers});
}
