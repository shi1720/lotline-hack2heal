import { requireChatGPTUser } from "@/app/chatgpt-auth";
import Workbench from "./workbench";
export const dynamic = "force-dynamic";
export default async function Home() {
  await requireChatGPTUser("/");
  return <Workbench />;
}
