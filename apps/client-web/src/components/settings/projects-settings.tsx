import { useState, useEffect, useCallback } from 'react';
import { multiCoreStore, workspaceStore, maestroStore } from '@condrix/client-shared';
import type { ProjectInfo, WorkspaceInfo, WorkspaceState } from '@condrix/protocol';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.js';

// ─── Workspace state badge colors ───────────────────────────────────────────

const STATE_VARIANT: Record<WorkspaceState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATING: 'secondary',
  IDLE: 'outline',
  ACTIVE: 'default',
  WAITING: 'secondary',
  SUSPENDED: 'outline',
  ERRORED: 'destructive',
  DESTROYED: 'destructive',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface CoreProjects {
  coreId: string;
  coreName: string;
  projects: ProjectInfo[];
  loading: boolean;
  error: string | null;
}

interface DeleteTarget {
  type: 'workspace' | 'project';
  coreId: string;
  id: string;
  name: string;
  projectName?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProjectsSettings() {
  const [coreProjects, setCoreProjects] = useState<CoreProjects[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchAllProjects = useCallback(async () => {
    const entries: CoreProjects[] = [];

    // Maestro mode: cores registered via Maestro
    const { state: maestroState, maestroCores } = maestroStore.getState();
    if (maestroState === 'connected' && maestroCores.length > 0) {
      for (const mc of maestroCores) {
        if (mc.status !== 'online') continue;
        entries.push({
          coreId: mc.id,
          coreName: mc.displayName,
          projects: [],
          loading: true,
          error: null,
        });
      }
    }

    // Direct mode: cores connected via WebSocket
    const { connections } = multiCoreStore.getState();
    for (const [coreId, conn] of connections) {
      if (conn.connState !== 'connected') continue;
      // Skip if already added from Maestro
      if (entries.some((e) => e.coreId === coreId)) continue;
      entries.push({
        coreId,
        coreName: conn.coreInfo?.displayName ?? coreId.slice(0, 8),
        projects: [],
        loading: true,
        error: null,
      });
    }

    setCoreProjects(entries.map((e) => ({ ...e })));

    // Fetch projects in parallel
    const updated = await Promise.all(
      entries.map(async (entry) => {
        try {
          const result = await multiCoreStore
            .getState()
            .requestOnCore<{ projects: ProjectInfo[] }>(entry.coreId, 'project', 'list', {});
          return { ...entry, projects: result.projects, loading: false };
        } catch (err) {
          return { ...entry, loading: false, error: (err as Error).message };
        }
      }),
    );

    setCoreProjects(updated);
  }, []);

  useEffect(() => {
    fetchAllProjects();
  }, [fetchAllProjects]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const openDeleteDialog = (target: DeleteTarget) => {
    setDeleteTarget(target);
    setDeleteFiles(false);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    setDeleteFiles(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      if (deleteTarget.type === 'workspace') {
        await workspaceStore
          .getState()
          .destroyWorkspace(deleteTarget.id, deleteTarget.coreId, deleteFiles);
      } else {
        await multiCoreStore.getState().requestOnCore(deleteTarget.coreId, 'project', 'delete', {
          projectId: deleteTarget.id,
        });
      }
      closeDeleteDialog();
      await fetchAllProjects();
    } catch {
      // Error is non-critical; the dialog will close and list will refresh
      closeDeleteDialog();
      await fetchAllProjects();
    } finally {
      setDeleting(false);
    }
  };

  const connectedCores = coreProjects.filter((c) => c.projects.length > 0 || c.loading);
  const hasNoCores = coreProjects.length === 0;
  const hasNoProjects =
    !hasNoCores && connectedCores.every((c) => c.projects.length === 0 && !c.loading);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Projects</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Manage projects and workspaces across your connected Cores.
        </p>
      </div>

      {hasNoCores && (
        <div className="p-4 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <p className="text-sm text-[var(--text-muted)]">
            No Cores connected. Connect a Core in the Cores tab to see projects.
          </p>
        </div>
      )}

      {hasNoProjects && (
        <div className="p-4 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
          <p className="text-sm text-[var(--text-muted)]">No projects found on connected Cores.</p>
        </div>
      )}

      {coreProjects.map((core) => (
        <CoreSection
          key={core.coreId}
          core={core}
          expandedProjects={expandedProjects}
          onToggleProject={toggleProject}
          onDeleteWorkspace={(ws, projectName) =>
            openDeleteDialog({
              type: 'workspace',
              coreId: core.coreId,
              id: ws.id,
              name: ws.name,
              projectName,
            })
          }
          onDeleteProject={(project) =>
            openDeleteDialog({
              type: 'project',
              coreId: core.coreId,
              id: project.id,
              name: project.name,
            })
          }
        />
      ))}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === 'project' ? 'Project' : 'Workspace'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'project' ? (
                <>
                  This will permanently delete the project <strong>{deleteTarget.name}</strong> and
                  all its workspaces. This action cannot be undone.
                </>
              ) : (
                <>
                  This will destroy the workspace <strong>{deleteTarget?.name}</strong>
                  {deleteTarget?.projectName && (
                    <>
                      {' '}
                      in project <strong>{deleteTarget.projectName}</strong>
                    </>
                  )}
                  . This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteTarget?.type === 'workspace' && (
            <label className="flex items-center gap-2 cursor-pointer px-1">
              <Checkbox
                checked={deleteFiles}
                onCheckedChange={(checked) => setDeleteFiles(checked === true)}
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Also delete workspace files on disk
              </span>
            </label>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Core Section ───────────────────────────────────────────────────────────

interface CoreSectionProps {
  core: CoreProjects;
  expandedProjects: Set<string>;
  onToggleProject: (projectId: string) => void;
  onDeleteWorkspace: (ws: WorkspaceInfo, projectName: string) => void;
  onDeleteProject: (project: ProjectInfo) => void;
}

function CoreSection({
  core,
  expandedProjects,
  onToggleProject,
  onDeleteWorkspace,
  onDeleteProject,
}: CoreSectionProps) {
  if (core.loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
          {core.coreName}
        </h3>
        <p className="text-xs text-[var(--text-muted)] pl-4">Loading projects...</p>
      </div>
    );
  }

  if (core.error) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-red)]" />
          {core.coreName}
        </h3>
        <p className="text-xs text-[var(--accent-red)] pl-4">
          Failed to load projects: {core.error}
        </p>
      </div>
    );
  }

  if (core.projects.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
          {core.coreName}
        </h3>
        <p className="text-xs text-[var(--text-muted)] pl-4">No projects</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
        {core.coreName}
      </h3>

      {core.projects.map((project) => {
        const isExpanded = expandedProjects.has(project.id);
        return (
          <div
            key={project.id}
            className="ml-4 rounded border border-[var(--border-color)] bg-[var(--bg-primary)]"
          >
            {/* Project header */}
            <div className="px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-2 text-left min-w-0"
                  onClick={() => onToggleProject(project.id)}
                >
                  <span className="text-xs text-[var(--text-muted)] select-none shrink-0">
                    {isExpanded ? '\u25BC' : '\u25B6'}
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {project.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    ({project.workspaces.length})
                  </span>
                </button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0 text-xs h-7 px-2"
                  onClick={() => onDeleteProject(project)}
                >
                  Delete
                </Button>
              </div>
              {(project.url || project.path) && (
                <div
                  className="text-xs text-[var(--text-muted)] font-mono truncate pl-5"
                  title={project.url ?? project.path}
                >
                  {project.url ?? project.path}
                </div>
              )}
            </div>

            {/* Expanded workspaces */}
            {isExpanded && project.workspaces.length > 0 && (
              <div className="border-t border-[var(--border-color)]">
                {project.workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-color)] last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-primary)] truncate">
                          {ws.name}
                        </span>
                        <Badge variant={STATE_VARIANT[ws.state]} className="text-[10px] shrink-0">
                          {ws.state}
                        </Badge>
                      </div>
                      {ws.workDir && (
                        <div
                          className="text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5"
                          title={ws.workDir}
                        >
                          {ws.workDir}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0 text-xs h-7 px-2"
                      onClick={() => onDeleteWorkspace(ws, project.name)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && project.workspaces.length === 0 && (
              <div className="border-t border-[var(--border-color)] px-3 py-2">
                <p className="text-xs text-[var(--text-muted)]">No workspaces in this project</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
