import type { WorkspaceInfo, WorkspaceState } from '@nexus-core/protocol';

/**
 * Manages workspace lifecycle within a project.
 * Each workspace encapsulates an isolated environment with its own agent session,
 * terminal pool, file watcher, and git tracker.
 */
export class WorkspaceManager {
  private workspaces = new Map<string, WorkspaceInfo>();

  async createWorkspace(projectId: string, name: string): Promise<WorkspaceInfo> {
    const workspace: WorkspaceInfo = {
      id: `ws_${Date.now()}`,
      projectId,
      name,
      state: 'CREATING',
    };
    this.workspaces.set(workspace.id, workspace);
    // TODO: Initialize working directory, git worktree, agent session
    workspace.state = 'IDLE';
    return workspace;
  }

  getWorkspace(id: string): WorkspaceInfo | undefined {
    return this.workspaces.get(id);
  }

  listWorkspaces(projectId?: string): WorkspaceInfo[] {
    const all = Array.from(this.workspaces.values());
    return projectId ? all.filter((ws) => ws.projectId === projectId) : all;
  }

  async transitionState(id: string, newState: WorkspaceState): Promise<void> {
    const workspace = this.workspaces.get(id);
    if (!workspace) throw new Error(`Workspace ${id} not found`);
    workspace.state = newState;
  }

  async destroyWorkspace(id: string): Promise<void> {
    await this.transitionState(id, 'DESTROYED');
    this.workspaces.delete(id);
  }
}
