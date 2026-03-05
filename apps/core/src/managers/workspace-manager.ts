import type { WorkspaceInfo, WorkspaceState } from '@nexus-core/protocol';
import { generateId } from '@nexus-core/protocol';
import type { EventEmitter } from 'node:events';

import type { CoreDatabase } from '../database.js';

const VALID_TRANSITIONS: Record<WorkspaceState, WorkspaceState[]> = {
  CREATING: ['IDLE', 'ERRORED', 'DESTROYED'],
  IDLE: ['ACTIVE', 'SUSPENDED', 'DESTROYED'],
  ACTIVE: ['IDLE', 'WAITING', 'ERRORED', 'DESTROYED'],
  WAITING: ['ACTIVE', 'ERRORED', 'DESTROYED'],
  SUSPENDED: ['IDLE', 'DESTROYED'],
  ERRORED: ['IDLE', 'DESTROYED'],
  DESTROYED: [],
};

/**
 * Manages workspace lifecycle within a project.
 * Each workspace encapsulates an isolated environment with its own agent session,
 * terminal pool, file watcher, and git tracker.
 */
export class WorkspaceManager {
  constructor(
    private db: CoreDatabase,
    private emitter: EventEmitter,
  ) {}

  createWorkspace(
    projectId: string,
    name: string,
    branch?: string,
    agentProvider?: string,
  ): WorkspaceInfo {
    const id = generateId('ws');
    this.db.insertWorkspace(id, projectId, name, 'CREATING', branch, agentProvider);
    // Transition to IDLE immediately (real init will be async in future)
    this.db.updateWorkspaceState(id, 'IDLE');
    const workspace = this.db.getWorkspace(id)!;
    this.emitter.emit('workspace:created', workspace);
    return workspace;
  }

  getWorkspace(id: string): WorkspaceInfo | undefined {
    return this.db.getWorkspace(id);
  }

  listWorkspaces(projectId?: string): WorkspaceInfo[] {
    return this.db.listWorkspaces(projectId);
  }

  transitionState(id: string, newState: WorkspaceState): WorkspaceInfo {
    const workspace = this.db.getWorkspace(id);
    if (!workspace) throw new Error(`Workspace ${id} not found`);

    const allowed = VALID_TRANSITIONS[workspace.state];
    if (!allowed.includes(newState)) {
      throw new Error(
        `Invalid transition: ${workspace.state} → ${newState}`,
      );
    }

    const previousState = workspace.state;
    this.db.updateWorkspaceState(id, newState);
    this.emitter.emit('workspace:stateChanged', {
      workspaceId: id,
      previousState,
      newState,
    });
    return this.db.getWorkspace(id)!;
  }

  destroyWorkspace(id: string): boolean {
    const workspace = this.db.getWorkspace(id);
    if (!workspace) return false;

    // Allow destroy from any state except DESTROYED
    if (workspace.state !== 'DESTROYED') {
      this.db.updateWorkspaceState(id, 'DESTROYED');
    }
    const deleted = this.db.deleteWorkspace(id);
    if (deleted) {
      this.emitter.emit('workspace:destroyed', { workspaceId: id });
    }
    return deleted;
  }
}

export { VALID_TRANSITIONS };
