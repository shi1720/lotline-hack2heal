import { DomainError, type Workspace } from './domain';
export type WorkspaceScope = 'demo' | 'inventory';
export function workspaceScope(request:Request):WorkspaceScope {
  const scope = new URL(request.url).searchParams.get('scope') || 'demo';
  if (scope !== 'demo' && scope !== 'inventory') throw new DomainError('Unknown workspace.',400);
  return scope;
}
export function workspaceKey(owner:string, scope:WorkspaceScope) {
  return scope === 'demo' ? owner : JSON.stringify([owner,'inventory']);
}
export function emptyWorkspace():Workspace {
  return {schemaVersion:1,stock:[],recalls:[],movements:[],audit:[],processed:[],requestHashes:{}};
}
