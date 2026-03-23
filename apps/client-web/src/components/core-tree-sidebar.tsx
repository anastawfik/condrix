import { useState, useEffect, useCallback } from 'react';
import { useStore } from 'zustand';
import { ChevronDown, ChevronRight, FolderOpen, Plus, Server, Layers, Trash2, RotateCw, AlertCircle, Terminal } from 'lucide-react';
import { multiCoreStore, workspaceStore, coreRegistryStore, maestroStore } from '@nexus-core/client-shared';
import type { MaestroConnectionState } from '@nexus-core/client-shared';
import type { ProjectInfo, WorkspaceInfo } from '@nexus-core/protocol';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AddProjectDialog } from '@nexus-core/client-components';

const STATE_DOT_COLOR: Record<string, string> = {
  CREATING: 'bg-primary',
  IDLE: 'bg-muted-foreground',
  ACTIVE: 'bg-green-500',
  WAITING: 'bg-yellow-500',
  SUSPENDED: 'bg-orange-500',
  ERRORED: 'bg-red-500',
  DESTROYED: 'bg-muted-foreground opacity-40',
};

const CONN_DOT: Record<string, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  reconnecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
  online: 'bg-green-500',
  offline: 'bg-muted-foreground',
};

/** Unified representation of a Core in the sidebar tree. */
interface SidebarCore {
  /** The ID used for requestOnCore calls. */
  coreId: string;
  name: string;
  status: string;
  /** Auth status — fetched on connect. */
  authStatus?: { authenticated: boolean; method: string; expiresAt?: string; claudeInstalled: boolean };
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

  // Auth status per core
  const [authStatuses, setAuthStatuses] = useState<Map<string, SidebarCore['authStatus']>>(new Map());

  const isOnline = useCallback((status: string) => {
    return status === 'connected' || status === 'online';
  }, []);

  // Fetch auth status for connected cores
  useEffect(() => {
    for (const core of cores) {
      if ((core.status === 'connected' || core.status === 'online') && !authStatuses.has(core.coreId)) {
        multiCoreStore.getState().requestOnCore<SidebarCore['authStatus']>(
          core.coreId, 'core', 'auth.status', {},
        ).then((status) => {
          setAuthStatuses((prev) => new Map(prev).set(core.coreId, status));
        }).catch(() => { /* ignore */ });
      }
    }
  }, [cores]);

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
    <div className="flex flex-col h-full bg-card text-sm select-none">
      {/* Header */}
      <div className="px-3 py-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
        Cores
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1 py-1">
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
                  'flex items-center gap-1.5 w-full pl-3 pr-2 py-2 transition-colors',
                  online ? 'hover:bg-accent' : 'opacity-50',
                )}
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', CONN_DOT[core.status] ?? CONN_DOT.disconnected)} />
                <Server className="size-4 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">{core.name}</span>
                {online && authStatuses.get(core.coreId) && !authStatuses.get(core.coreId)!.authenticated && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-auto shrink-0">
                        <AlertCircle className="size-4 text-destructive" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Authentication required — open Core Terminal to run `claude auth login`</TooltipContent>
                  </Tooltip>
                )}
              </button>

              {isExpanded && online && (
                <>
                  {projects.map((project) => {
                    const projectExpanded = expandedProjects.has(project.id);
                    const workspaces = project.workspaces.filter((w) => w.state !== 'DESTROYED');

                    return (
                      <div key={project.id}>
                        {/* Level 1: Project node */}
                        <div className="group flex items-center w-full pl-6 pr-2 py-2 hover:bg-accent transition-colors">
                          <button
                            onClick={() => toggleProject(project.id)}
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                          >
                            {projectExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            <FolderOpen className="size-4 text-primary shrink-0" />
                            <span className="truncate text-foreground">{project.name}</span>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProject(project.id, core.coreId)}
                            className="hidden group-hover:flex p-0.5 h-auto text-muted-foreground hover:text-red-500"
                            title="Delete project"
                            aria-label="Delete project"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        {projectExpanded && (
                          <>
                            {workspaces.map((ws) => {
                              const isActive = ws.id === currentWorkspaceId;
                              const dotColor = STATE_DOT_COLOR[ws.state] ?? 'bg-muted-foreground';
                              const canEnter = ws.state !== 'DESTROYED' && ws.state !== 'CREATING';

                              return (
                                // Level 2: Workspace node
                                <div
                                  key={ws.id}
                                  className={cn(
                                    'group/ws flex items-center gap-2 w-full pl-12 pr-2 py-2 transition-colors',
                                    isActive
                                      ? 'bg-accent text-foreground border-l-2 border-l-primary'
                                      : 'text-muted-foreground hover:bg-accent hover:text-foreground border-l-2 border-l-transparent',
                                    (!canEnter || loading) && 'opacity-50',
                                  )}
                                >
                                  <button
                                    onClick={canEnter ? () => handleSelectWorkspace(ws, core.coreId) : undefined}
                                    disabled={loading || !canEnter}
                                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                  >
                                    <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColor)} />
                                    <span className="truncate">{ws.name}</span>
                                    {ws.state === 'CREATING' && <span className="text-xs text-primary">creating...</span>}
                                    {ws.state === 'ERRORED' && <span className="text-xs text-red-500">error</span>}
                                  </button>
                                  <div className="hidden group-hover/ws:flex items-center gap-0.5 shrink-0">
                                    {ws.state === 'ERRORED' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRetryWorkspace(ws, core.coreId)}
                                        className="p-0.5 h-auto text-muted-foreground hover:text-primary"
                                        title="Retry"
                                        aria-label="Retry workspace"
                                      >
                                        <RotateCw className="size-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDestroyWorkspace(ws.id, core.coreId)}
                                      className="p-0.5 h-auto text-muted-foreground hover:text-red-500"
                                      title="Delete workspace"
                                      aria-label="Delete workspace"
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* New workspace form (level 2) */}
                            {addingWorkspaceFor === project.id ? (
                              <div className="ml-12 mr-2 my-1 p-2 rounded bg-secondary space-y-1.5">
                                <Input
                                  value={wsName}
                                  onChange={(e) => setWsName(e.target.value)}
                                  placeholder="Workspace name"
                                  autoFocus
                                  disabled={creatingWorkspace}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !creatingWorkspace) handleCreateWorkspace(project.id, core.coreId); }}
                                />
                                {wsError && (
                                  <p className="text-xs text-red-500">{wsError}</p>
                                )}
                                {creatingWorkspace ? (
                                  <div className="flex items-center gap-2 py-1">
                                    <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs text-muted-foreground">Cloning repository...</span>
                                  </div>
                                ) : (
                                  <div className="flex gap-1.5 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => { setAddingWorkspaceFor(null); setWsError(null); }}>Cancel</Button>
                                    <Button size="sm" onClick={() => handleCreateWorkspace(project.id, core.coreId)} disabled={!wsName.trim()}>Create</Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setAddingWorkspaceFor(project.id); setWsName(''); }}
                                className="flex items-center gap-1.5 w-full pl-12 pr-2 py-2 justify-start text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              >
                                <Plus className="size-4" />
                                New Workspace
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Add project (level 1) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddProjectCoreId(core.coreId)}
                    className="flex items-center gap-1.5 w-full pl-6 pr-2 py-2 justify-start text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Plus className="size-4" />
                    Add Project
                  </Button>
                </>
              )}
            </div>
          );
        })}

        {cores.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Layers className="size-8 mb-2" />
            <span className="text-sm">No Cores connected</span>
          </div>
        )}
      </ScrollArea>

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
