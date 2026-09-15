import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { redirect } from 'next/navigation';
import Workbench from './workbench';
import AccountMenu from './account-menu';
export const dynamic = 'force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{scope?:string}>}) {
  const user = await requireChatGPTUser('/');
  const params = await searchParams;
  const scope = params.scope === 'demo' ? 'demo' : params.scope === 'inventory' ? 'inventory' : user.isAnonymous ? 'demo' : 'inventory';
  if (scope === 'inventory' && user.isAnonymous) redirect('/signin');
  return <Workbench scope={scope} signInPath="/signin" accountControl={<AccountMenu label={user.displayName} guest={user.isAnonymous}/>}/>;
}
