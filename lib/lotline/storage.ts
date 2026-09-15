import { env } from "cloudflare:workers";
import { seed, audit, DomainError, type Workspace } from "./domain";
import { emptyWorkspace, workspaceKey, type WorkspaceScope } from "./scope";
function db() {
  if (!env.DB)
    throw new DomainError(
      "Storage is temporarily unavailable. Your changes have not been saved.",
      503,
    );
  return env.DB;
}
export async function readWorkspace(owner: string, actor: string, scope:WorkspaceScope = "demo") {
  owner = workspaceKey(owner,scope);
  let row = await db()
    .prepare("SELECT state, revision FROM workspaces WHERE owner = ?")
    .bind(owner)
    .first<{ state: string; revision: number }>();
  if (!row) {
    const now = new Date().toISOString();
    const w = scope === "inventory" ? emptyWorkspace() : seed(actor, now);
    await audit(
      w,
      actor,
      "created",
      scope === "inventory" ? "Created empty inventory workspace." : "Created fictional evaluation workspace. Sample scope is pre-reviewed for this exercise.",
      now,
      crypto.randomUUID(),
    );
    await db()
      .prepare(
        "INSERT OR IGNORE INTO workspaces (owner,state,revision,updated_at) VALUES (?,?,0,?)",
      )
      .bind(owner, JSON.stringify(w), now)
      .run();
    row = await db()
      .prepare("SELECT state, revision FROM workspaces WHERE owner = ?")
      .bind(owner)
      .first<{ state: string; revision: number }>();
  }
  if (!row) throw new DomainError("Workspace could not be loaded.", 503);
  return {
    workspace: JSON.parse(row.state) as Workspace,
    revision: row.revision,
  };
}
export async function saveWorkspace(
  owner: string,
  workspace: Workspace,
  revision: number,
  scope:WorkspaceScope = "demo",
) {
  owner = workspaceKey(owner,scope);
  const serialized = JSON.stringify(workspace);
  if (new TextEncoder().encode(serialized).byteLength > 1_500_000) {
    throw new DomainError(
      "Evaluation storage capacity reached. Export existing records before starting a fresh practice workspace.",
      413,
    );
  }
  const result = await db()
    .prepare(
      "UPDATE workspaces SET state = ?, revision = revision + 1, updated_at = ? WHERE owner = ? AND revision = ?",
    )
    .bind(serialized, new Date().toISOString(), owner, revision)
    .run();
  if (result.meta.changes !== 1)
    throw new DomainError(
      "Another change arrived first. Refresh and review the latest quantities before retrying.",
      409,
    );
  return revision + 1;
}
