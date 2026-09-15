import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readWorkspace, saveWorkspace } from "@/lib/lotline/storage";
import { actionSchema, applyAction } from "@/lib/lotline/actions";
import { readBody } from "@/lib/lotline/request";
import { DomainError } from "@/lib/lotline/domain";
import { z } from "zod";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function failure(e: unknown) {
  if (e instanceof DomainError)
    return Response.json({ error: e.message }, { status: e.status, headers });
  if (e instanceof z.ZodError)
    return Response.json(
      { error: e.issues.map((i) => i.message).join(" ") },
      { status: 400, headers },
    );
  console.error(
    "workspace operation failed",
    e instanceof Error ? e.message : "unknown error",
  );
  return Response.json(
    {
      error:
        "Storage is temporarily unavailable. Your changes have not been saved. Please retry.",
    },
    { status: 503, headers },
  );
}
export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user)
      return Response.json(
        { error: "Sign in to open your workspace." },
        { status: 401, headers },
      );
    return Response.json(
      {
        ...(await readWorkspace(user.userId, user.displayName)),
        actor: user.displayName,
      },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user)
      return Response.json(
        { error: "Sign in to save changes." },
        { status: 401, headers },
      );
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      return Response.json(
        { error: "This change must originate from the same site." },
        { status: 403, headers },
      );
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return Response.json(
        { error: "Use a JSON request." },
        { status: 415, headers },
      );
    const text = await readBody(request);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "Invalid JSON request." },
        { status: 400, headers },
      );
    }
    const envelope = z
      .object({
        revision: z.number().int().min(0),
        requestId: z.string().uuid(),
        action: actionSchema,
      })
      .parse(payload);
    const current = await readWorkspace(user.userId, user.displayName);
    if (
      current.workspace.processed.includes(envelope.requestId) ||
      current.workspace.audit.some((e) => e.id === envelope.requestId) ||
      current.workspace.movements.some((m) => m.id === envelope.requestId)
    ) {
      await applyAction(
        current.workspace,
        envelope.action,
        user.displayName,
        envelope.requestId,
      );
      return Response.json(
        { ...current, actor: user.displayName },
        { headers },
      );
    }
    if (current.revision !== envelope.revision)
      throw new DomainError(
        "Workspace changed. Refresh before submitting this action again.",
        409,
      );
    const workspace = await applyAction(
      current.workspace,
      envelope.action,
      user.displayName,
      envelope.requestId,
    );
    const revision = await saveWorkspace(
      user.userId,
      workspace,
      current.revision,
    );
    return Response.json(
      { workspace, revision, actor: user.displayName },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
