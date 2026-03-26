import { useState, useEffect, useCallback } from 'react';
import { useStore } from 'zustand';
import { ChevronDown, ChevronRight, FolderOpen, Plus, Server, Layers, Trash2, RotateCw } from 'lucide-react';
import { multiCoreStore, workspaceStore, coreRegistryStore, maestroStore } from '@condrix/client-shared';
import type { MaestroConnectionState } from '@condrix/client-shared';
import type { ProjectInfo, WorkspaceInfo } from '@condrix/protocol';
import { cn } from './lib/utils.js';
import { Button } from './button.js';
import { Input } from './input.js';
import { AddProjectDialog } from './add-project-dialog.js';

const STATE_DOT_COLOR: Record<string, string> = {
  CREATING: 'bg-[var(--accent-blue)]',
  IDLE: 'bg-[var(--text-muted)]',
  ACTIVE: 'bg-[var(--accent-green)]',
  WAITING: 'bg-[var(--accent-yellow)]',
  SUSPENDED: 'bg-[var(--accent-orange)]',
  ERRORED: 'bg-[var(--accent-red)]',
  DESTROYED: 'bg-[var(--text-muted)] opacity-40',
};

const CONN_DOT: Record<string, string> = {
  connected: 'bg-[var(--accent-green)]',
  connecting: 'bg-[var(--accent-yellow)]',
  reconnecting: 'bg-[var(--accent-yellow)]',
  disconnected: 'bg-[var(--accent-red)]',
  online: 'bg-[var(--accent-green)]',
  offline: 'bg-[var(--text-muted)]',
};

/** Unified representation of a Core in the sidebar tree. */
interface SidebarCore {
  /** The ID used for requestOnCore calls. */
  coreId: string;
  name: string;
  status: string;
}

export interface CoreTreeSidebarProps {
  onWorkspaceSelected?: () => void;
}

export function CoreTreeSidebar({ onWorkspaceSelected }: CoreTreeSidebarProps) {
  const maestroState = useStore(maestroStore, (s) => s.state);

  if (maestroState === 'connected') {
    return <MaestroSidebarTree onWorkspaceSelected={onWorkspaceSelected} />;
  }
  return <DirectSidebarTree onWorkspaceSelected={onWorkspaceSelected} />;
}

/* ─── Direct Mode Sidebar ──────────────────────────────────────────────── */

function DirectSidebarTree({ onWorkspaceSelected }: { onWorkspaceSelected?: () => void }) {
  const connections = useStore(multiCoreStore, (s) => s.connections);
  const registryCores = useStore(coreRegistryStore, (s) => s.cores);

  // Build sidebar cores from direct connections
  const sidebarCores: SidebarCore[] = Array.from(connections.entries()).map(([coreId, conn]) => ({
    coreId,
    name: registryCores.find((c) => c.id === coreId)?.name ?? coreId,
    status: conn.connState,
  }));

  return <SidebarTree cores={sidebarCores} onWorkspaceSelected={onWorkspaceSelected} />;
}

/* ─── Maestro Mode Sidebar ─────────────────────────────────────────────── */

function MaestroSidebarTree({ onWorkspaceSelected }: { onWorkspaceSelected?: () => void }) {
  const maestroCores = useStore(maestroStore, (s) => s.maestroCores);

  // Build sidebar cores from Maestro-registered cores
  // Use mc.id (DB row ID) — Maestro relay routes by DB ID, not logical coreId
  const sidebarCores: SidebarCore[] = maestroCores.map((mc) => ({
    coreId: mc.id,
    name: mc.displayName,
    status: mc.status, // 'online' | 'offline'
  }));

  return <SidebarTree cores={sidebarCores} onWorkspaceSelected={onWorkspaceSelected} />;
}

/* ─── Shared Sidebar Tree ──────────────────────────────────────────────── */

function SidebarTree({ cores, onWorkspaceSelected }: { cores: SidebarCore[]; onWorkspaceSelected?: () => void }) {
  const currentWorkspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);

  const [expandedCores, setExpandedCores] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [coreProjects, setCoreProjects] = useState<Map<string, ProjectInfo[]>>(new Map());
  const [addProjectCoreId, setAddProjectCoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New workspace inline form
  const [addingWorkspaceFor, setAddingWorkspaceFor] = useState<string | null>(null);
  const [wsName, setWsName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const isOnline = useCallback((status: string) => {
    return status === 'connected' || status === 'online';
  }, []);

  const fetchProjects = useCallback(async (coreId: string) => {
    try {
      const result = await multiCoreStore.getState().requestOnCore<{ projects: ProjectInfo[] }>(
        coreId, 'project', 'list', {},
      );
      setCoreProjects((prev) => new Map(prev).set(coreId, result.projects));
    } catch {
      // failed to fetch
    }
  }, []);

  const toggleCore = useCallback((coreId: string) => {
    setExpandedCores((prev) => {
      const next = new Set(prev);
      if (next.has(coreId)) {
        next.delete(coreId);
      } else {
        next.add(coreId);
        fetchProjects(coreId);
      }
      return next;
    });
  }, [fetchProjects]);

  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleSelectWorkspace = async (ws: WorkspaceInfo, coreId: string) => {
    setLoading(true);
    try {
      multiCoreStore.getState().setActiveCoreId(coreId);

      // Suspend current workspace if switching
      const { currentWorkspaceId: curWs } = workspaceStore.getState();
      if (curWs && curWs !== ws.id) {
        await workspaceStore.getState().suspendWorkspace(curWs, coreId).catch(() => {});
      }

      // Resume if suspended, then enter; if already active just select it
      if (ws.state === 'SUSPENDED') {
        await workspaceStore.getState().resumeWorkspace(ws.id, coreId);
      }

      if (ws.state === 'ACTIVE') {
        // Already active — just set as current without re-entering
        workspaceStore.getState().setCurrentWorkspace(ws.id, coreId);
      } else {
        await workspaceStore.getState().enterWorkspace(ws.id, coreId);
      }

      workspaceStore.getState().setCurrentProject(ws.projectId);
      onWorkspaceSelected?.();
    } catch (err) {
      console.error('[Sidebar] Failed to select workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (projectId: string, coreId: string) => {
    if (!wsName.trim()) return;
    setCreatingWorkspace(true);
    setWsError(null);
    try {
      const ws = await workspaceStore.getState().createWorkspace(projectId, wsName.trim(), undefined, coreId);

      // Check if the workspace was created in ERRORED state (clone failure)
      if (ws.state === 'ERRORED') {
        setWsError('Failed to set up workspace directory. Check Core logs.');
        fetchProjects(coreId);
        return;
      }

      await workspaceStore.getState().enterWorkspace(ws.id, coreId);
      multiCoreStore.getState().setActiveCoreId(coreId);
      setWsName('');
      setAddingWorkspaceFor(null);
      setWsError(null);
      fetchProjects(coreId);
      onWorkspaceSelected?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      setWsError(message);
      fetchProjects(coreId);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleDestroyWorkspace = async (wsId: string, coreId: string) => {
    try {
      await workspaceStore.getState().destroyWorkspace(wsId, coreId);
      fetchProjects(coreId);
    } catch {
      // error
    }
  };

  const handleRetryWorkspace = async (ws: WorkspaceInfo, coreId: string) => {
    try {
      // Resume transitions ERRORED → IDLE
      await workspaceStore.getState().resumeWorkspace(ws.id, coreId);
      await handleSelectWorkspace({ ...ws, state: 'IDLE' }, coreId);
      fetchProjects(coreId);
    } catch (err) {
      console.error('[Sidebar] Failed to retry workspace:', err);
    }
  };

  const handleDeleteProject = async (projectId: string, coreId: string) => {
    try {
      await multiCoreStore.getState().requestOnCore(coreId, 'project', 'delete', { projectId });
      setCoreProjects((prev) => {
        const next = new Map(prev);
        const projects = next.get(coreId)?.filter((p) => p.id !== projectId) ?? [];
        next.set(coreId, projects);
        return next;
      });
    } catch {
      // error
    }
  };

  // Auto-expand and fetch projects for online cores
  useEffect(() => {
    for (const core of cores) {
      if (isOnline(core.status) && !coreProjects.has(core.coreId)) {
        setExpandedCores((prev) => new Set(prev).add(core.coreId));
        fetchProjects(core.coreId);
      }
    }
  }, [cores, fetchProjects, isOnline]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] text-xs select-none">
      {/* Header */}
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
        Cores
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {cores.map((core) => {
          const projects = coreProjects.get(core.coreId) ?? [];
          const isExpanded = expandedCores.has(core.coreId);
          const online = isOnline(core.status);

          return (
            <div key={core.coreId}>
              {/* Level 0: Core node */}
              <button
                onClick={online ? () => toggleCore(core.coreId) : undefined}
                disabled={!online}
                className={cn(
                  'flex items-center gap-1.5 w-full pl-2 pr-2 py-1.5 transition-colors',
                  online ? 'hover:bg-[var(--bg-hover)]' : 'opacity-50',
                )}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className={cn('w-2 h-2 rounded-full shrink-0', CONN_DOT[core.status] ?? CONN_DOT.disconnected)} />
                <Server size={12} className="text-[var(--text-secondary)]" />
                <span className="truncate font-medium text-[var(--text-primary)]">{core.name}</span>
              </button>

              {isExpanded && online && (
                <>
                  {projects.map((project) => {
                    const projectExpanded = expandedProjects.has(project.id);
                    const workspaces = project.workspaces.filter((w) => w.state !== 'DESTROYED');

                    return (
                      <div key={project.id}>
                        {/* Level 1: Project node */}
                        <div className="group flex items-center w-full pl-6 pr-2 py-1 hover:bg-[var(--bg-hover)] transition-colors">
                          <button
                            onClick={() => toggleProject(project.id)}
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                          >
                            {projectExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            <FolderOpen size={12} className="text-[var(--accent-blue)] shrink-0" />
                            <span className="truncate text-[var(--text-primary)]">{project.name}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id, core.coreId)}
                            className="hidden group-hover:flex p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent-red)] shrink-0"
                            title="Delete project"
                            aria-label="Delete project"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>

                        {projectExpanded && (
                          <>
                            {workspaces.map((ws) => {
                              const isActive = ws.id === currentWorkspaceId;
                              const dotColor = STATE_DOT_COLOR[ws.state] ?? 'bg-[var(--text-muted)]';
                              const canEnter = ws.state !== 'DESTROYED' && ws.state !== 'CREATING';

                              return (
                                // Level 2: Workspace node
                                <div
                                  key={ws.id}
                                  className={cn(
                                    'group/ws flex items-center gap-2 w-full pl-12 pr-2 py-1 transition-colors',
                                    isActive
                                      ? 'bg-[var(--bg-active)] text-[var(--text-primary)] border-l-2 border-l-[var(--accent-blue)]'
                                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border-l-2 border-l-transparent',
                                    (!canEnter || loading) && 'opacity-50',
                                  )}
                                >
                                  <button
                                    onClick={canEnter ? () => handleSelectWorkspace(ws, core.coreId) : undefined}
                                    disabled={loading || !canEnter}
                                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                  >
                                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
                                    <span className="truncate">{ws.name}</span>
                                    {ws.state === 'CREATING' && <span className="text-[9px] text-[var(--accent-blue)]">creating...</span>}
                                    {ws.state === 'ERRORED' && <span className="text-[9px] text-[var(--accent-red)]">error</span>}
                                  </button>
                                  <div className="hidden group-hover/ws:flex items-center gap-0.5 shrink-0">
                                    {ws.state === 'ERRORED' && (
                                      <button
                                        onClick={() => handleRetryWorkspace(ws, core.coreId)}
                                        className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent-blue)]"
                                        title="Retry"
                                        aria-label="Retry workspace"
                                      >
                                        <RotateCw size={11} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDestroyWorkspace(ws.id, core.coreId)}
                                      className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent-red)]"
                                      title="Delete workspace"
                                      aria-label="Delete workspace"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* New workspace form (level 2) */}
                            {addingWorkspaceFor === project.id ? (
                              <div className="ml-12 mr-2 my-1 p-2 rounded bg-[var(--bg-tertiary)] space-y-1.5">
                                <Input
                                  value={wsName}
                                  onChange={(e) => setWsName(e.target.value)}
                                  placeholder="Workspace name"
                                  inputSize="sm"
                                  autoFocus
                                  disabled={creatingWorkspace}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !creatingWorkspace) handleCreateWorkspace(project.id, core.coreId); }}
                                />
                                {wsError && (
                                  <p className="text-[10px] text-[var(--accent-red)]">{wsError}</p>
                                )}
                                {creatingWorkspace ? (
                                  <div className="flex items-center gap-2 py-1">
                                    <span className="w-3 h-3 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[10px] text-[var(--text-muted)]">Cloning repository...</span>
                                  </div>
                                ) : (
                                  <div className="flex gap-1.5 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => { setAddingWorkspaceFor(null); setWsError(null); }}>Cancel</Button>
                                    <Button size="sm" onClick={() => handleCreateWorkspace(project.id, core.coreId)} disabled={!wsName.trim()}>Create</Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddingWorkspaceFor(project.id); setWsName(''); }}
                                className="flex items-center gap-1.5 w-full pl-12 pr-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                              >
                                <Plus size={10} />
                                New Workspace
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Add project (level 1) */}
                  <button
                    onClick={() => setAddProjectCoreId(core.coreId)}
                    className="flex items-center gap-1.5 w-full pl-6 pr-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Plus size={10} />
                    Add Project
                  </button>
                </>
              )}
            </div>
          );
        })}

        {cores.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)]">
            <Layers size={24} className="mb-2" />
            <span className="text-[11px]">No Cores connected</span>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {addProjectCoreId && (
        <AddProjectDialog
          coreId={addProjectCoreId}
          open={true}
          onClose={() => setAddProjectCoreId(null)}
          onCreated={() => fetchProjects(addProjectCoreId)}
        />
      )}
    </div>
  );
}
