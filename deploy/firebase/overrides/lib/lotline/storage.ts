import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { firestore } from '@/lib/firebase/admin';
import { seed, audit, DomainError, type Workspace } from './domain';
import { emptyWorkspace, workspaceKey, type WorkspaceScope } from "./scope";
const MAX_JSON_BYTES = 1_500_000;
const MAX_COMPRESSED_BYTES = 900_000;
const reference = (owner:string) => firestore().collection('lotline_workspaces').doc(createHash('sha256').update(owner).digest('hex'));
export function encodeWorkspace(workspace:Workspace) {
  const json = Buffer.from(JSON.stringify(workspace));
  if (json.length > MAX_JSON_BYTES) throw new DomainError('Evaluation storage capacity reached. Export records before resetting the practice workspace.',413);
  const state = gzipSync(json);
  if (state.length > MAX_COMPRESSED_BYTES) throw new DomainError('Compressed workspace capacity reached. Export records before resetting the practice workspace.',413);
  return state;
}
function decode(state:Buffer) {
  return JSON.parse(gunzipSync(state,{maxOutputLength:MAX_JSON_BYTES}).toString('utf8')) as Workspace;
}
export async function readWorkspace(owner:string, actor:string, scope:WorkspaceScope = "demo") {
  owner = workspaceKey(owner,scope);
  const ref = reference(owner);
  return firestore().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const data = snapshot.data()!;
      return {workspace:decode(data.state), revision:data.revision as number};
    }
    const now = new Date().toISOString();
    const workspace = scope === "inventory" ? emptyWorkspace() : seed(actor,now);
    await audit(workspace,actor,'created',scope === "inventory" ? "Created empty inventory workspace." : "Created fictional evaluation workspace. Sample scope is pre-reviewed for this exercise.",now,crypto.randomUUID());
    transaction.create(ref,{state:encodeWorkspace(workspace), revision:0, updatedAt:now});
    return {workspace, revision:0};
  });
}
export async function saveWorkspace(owner:string, workspace:Workspace, revision:number, scope:WorkspaceScope = "demo") {
  owner = workspaceKey(owner,scope);
  const state = encodeWorkspace(workspace);
  const ref = reference(owner);
  return firestore().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()!.revision !== revision) {
      throw new DomainError('Another change arrived first. Refresh and review the latest quantities before retrying.',409);
    }
    transaction.update(ref,{state, revision:revision+1, updatedAt:new Date().toISOString()});
    return revision+1;
  });
}
