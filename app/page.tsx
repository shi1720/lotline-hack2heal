import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import Workbench from "./workbench";
export const dynamic = "force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{scope?:string}>}) {
  const user = await requireChatGPTUser("/");
  const scope = (await searchParams).scope === "inventory" ? "inventory" : "demo";
  return <Workbench scope={scope} accountControl={<div className="account-menu"><span>{user.displayName}</span><a href={chatGPTSignOutPath()}>Sign out</a></div>}/>;
}
