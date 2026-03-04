import type { CoreInfo, WorkspaceInfo } from '@nexus-core/protocol';

/**
 * Maintains an in-memory projection of the global state,
 * backed by a persistent database (SQLite).
 */
export class StateStore {
  private cores = new Map<string, CoreInfo>();
  private workspaces = new Map<string, WorkspaceInfo>();

  upsertCore(core: CoreInfo): void {
    this.cores.set(core.coreId, core);
  }

  removeCore(coreId: string): void {
    this.cores.delete(coreId);
  }

  getCores(): CoreInfo[] {
    return Array.from(this.cores.values());
  }

  upsertWorkspace(workspace: WorkspaceInfo): void {
    this.workspaces.set(workspace.id, workspace);
  }

  getWorkspaces(coreId?: string): WorkspaceInfo[] {
    // TODO: Filter by coreId when core association is tracked
    return Array.from(this.workspaces.values());
  }

  getWaitingWorkspaces(): WorkspaceInfo[] {
    return Array.from(this.workspaces.values()).filter((ws) => ws.state === 'WAITING');
  }
}
