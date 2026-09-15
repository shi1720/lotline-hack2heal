import { getChatGPTUser } from '@/app/chatgpt-auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getChatGPTUser();
  return Response.json(user ? {email:user.email,displayName:user.displayName,isAnonymous:user.isAnonymous} : {error:'Not signed in.'},{status:user?200:401,headers:{'Cache-Control':'private, no-store'}});
}
