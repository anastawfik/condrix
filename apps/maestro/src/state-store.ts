import type { CoreInfo, WorkspaceInfo } from '@condrix/protocol';
import type { MaestroDatabase } from './database.js';

/**
 * Maintains an in-memory projection of the global state,
 * backed by the Maestro database for persistence across restarts.
 *
 * Tracks which Cores are online and their workspace states,
 * enabling Maestro to answer status queries and trigger notifications.
 */
export class StateStore {
  private cores = new Map<string, CoreInfo>();
  private workspaces = new Map<string, WorkspaceInfo & { coreDbId: string }>();

  constructor(private db: MaestroDatabase) {
    this.loadFromDb();
  }

  private loadFromDb(): void {
    const dbCores = this.db.listCores();
    for (const row of dbCores) {
      this.cores.set(row.core_id, {
        coreId: row.core_id,
        displayName: row.display_name,
        host: '',
        port: 0,
        status: row.status === 'online' ? 'online' : 'offline',
        lastHeartbeat: row.last_heartbeat ?? new Date().toISOString(),
      });
    }
  }

  // ─── Core State ──────────────────────────────────────────────────────────

  upsertCore(core: CoreInfo): void {
    this.cores.set(core.coreId, core);
  }

  removeCore(coreId: string): void {
    this.cores.delete(coreId);
    // Remove workspaces associated with this core
    for (const [id, ws] of this.workspaces) {
      if (ws.coreDbId === coreId) {
        this.workspaces.delete(id);
      }
    }
  }

  setCoreOnline(coreId: string, displayName: string): void {
    const existing = this.cores.get(coreId);
    if (existing) {
      existing.status = 'online';
      existing.lastHeartbeat = new Date().toISOString();
    } else {
      this.cores.set(coreId, {
        coreId,
        displayName,
        host: '',
        port: 0,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
      });
    }
  }

  setCoreOffline(coreId: string): void {
    const existing = this.cores.get(coreId);
    if (existing) {
      existing.status = 'offline';
    }
  }

  getCores(): CoreInfo[] {
    return Array.from(this.cores.values());
  }

  getOnlineCores(): CoreInfo[] {
    return Array.from(this.cores.values()).filter((c) => c.status === 'online');
  }

  getCoreCount(): { total: number; online: number } {
    const all = Array.from(this.cores.values());
    return {
      total: all.length,
      online: all.filter((c) => c.status === 'online').length,
    };
  }

  // ─── Workspace State ─────────────────────────────────────────────────────

  upsertWorkspace(coreDbId: string, workspace: WorkspaceInfo): void {
    this.workspaces.set(workspace.id, { ...workspace, coreDbId });
  }

  removeWorkspace(workspaceId: string): void {
    this.workspaces.delete(workspaceId);
  }

  getWorkspaces(coreId?: string): WorkspaceInfo[] {
    const all = Array.from(this.workspaces.values());
    if (coreId) {
      return all.filter((ws) => ws.coreDbId === coreId);
    }
    return all;
  }

  getWaitingWorkspaces(): WorkspaceInfo[] {
    return Array.from(this.workspaces.values()).filter((ws) => ws.state === 'WAITING');
  }

  getActiveWorkspaces(): WorkspaceInfo[] {
    return Array.from(this.workspaces.values()).filter((ws) => ws.state === 'ACTIVE');
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  getSummary(): {
    cores: { total: number; online: number };
    workspaces: { total: number; active: number; waiting: number };
  } {
    const workspaces = Array.from(this.workspaces.values());
    return {
      cores: this.getCoreCount(),
      workspaces: {
        total: workspaces.length,
        active: workspaces.filter((ws) => ws.state === 'ACTIVE').length,
        waiting: workspaces.filter((ws) => ws.state === 'WAITING').length,
      },
    };
  }
}
