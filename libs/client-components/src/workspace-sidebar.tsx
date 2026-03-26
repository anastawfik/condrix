import { useState, useEffect, useCallback } from 'react';
import { useStore } from 'zustand';
import { ChevronDown, ChevronRight, FolderOpen, Plus } from 'lucide-react';
import { workspaceStore } from '@condrix/client-shared';
import type { ProjectInfo, WorkspaceInfo } from '@condrix/protocol';
import { cn } from './lib/utils.js';
import { Button } from './button.js';
import { Input } from './input.js';

const STATE_DOT_COLOR: Record<string, string> = {
  CREATING: 'bg-[var(--accent-blue)]',
  IDLE: 'bg-[var(--text-muted)]',
  ACTIVE: 'bg-[var(--accent-green)]',
  WAITING: 'bg-[var(--accent-yellow)]',
  SUSPENDED: 'bg-[var(--accent-orange)]',
  ERRORED: 'bg-[var(--accent-red)]',
  DESTROYED: 'bg-[var(--text-muted)] opacity-40',
};

export interface WorkspaceSidebarProps {
  onWorkspaceEntered?: () => void;
}

/** @deprecated Use CoreTreeSidebar instead. */
export function WorkspaceSidebar({ onWorkspaceEntered }: WorkspaceSidebarProps) {
  const projects = useStore(workspaceStore, (s) => s.projects);
  const currentWorkspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // New workspace inline form state
  const [addingWorkspaceFor, setAddingWorkspaceFor] = useState<string | null>(null);
  const [wsName, setWsName] = useState('');
  const [wsBranch, setWsBranch] = useState('');

  useEffect(() => {
    workspaceStore.getState().fetchProjects().catch(() => {});
  }, []);

  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
        workspaceStore.getState().fetchWorkspaces(projectId).catch(() => {});
      }
      return next;
    });
  }, []);

  const handleEnterWorkspace = async (ws: WorkspaceInfo) => {
    setLoading(true);
    try {
      const store = workspaceStore.getState();
      if (currentWorkspaceId && currentWorkspaceId !== ws.id) {
        await store.suspendWorkspace(currentWorkspaceId).catch(() => {});
      }
      if (ws.state === 'SUSPENDED') {
        await store.resumeWorkspace(ws.id);
      }
      store.setCurrentProject(ws.projectId);
      await store.enterWorkspace(ws.id);
      onWorkspaceEntered?.();
    } catch {
      // Error in store
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (projectId: string) => {
    if (!wsName.trim()) return;
    setLoading(true);
    try {
      const ws = await workspaceStore.getState().createWorkspace(projectId, wsName.trim(), wsBranch.trim() || undefined);
      await workspaceStore.getState().enterWorkspace(ws.id);
      setWsName('');
      setWsBranch('');
      setAddingWorkspaceFor(null);
      onWorkspaceEntered?.();
    } catch {
      // Error in store
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] text-xs select-none">
      {/* Header */}
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]">
        Projects
      </div>

      {/* Project tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.map((project) => (
          <ProjectNode
            key={project.id}
            project={project}
            expanded={expandedProjects.has(project.id)}
            onToggle={() => toggleProject(project.id)}
            currentWorkspaceId={currentWorkspaceId}
            onEnterWorkspace={handleEnterWorkspace}
            addingWorkspace={addingWorkspaceFor === project.id}
            onStartAddWorkspace={() => { setAddingWorkspaceFor(project.id); setWsName(''); setWsBranch(''); }}
            wsName={wsName}
            onWsNameChange={setWsName}
            wsBranch={wsBranch}
            onWsBranchChange={setWsBranch}
            onCreateWorkspace={() => handleCreateWorkspace(project.id)}
            onCancelAddWorkspace={() => setAddingWorkspaceFor(null)}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

interface ProjectNodeProps {
  project: ProjectInfo;
  expanded: boolean;
  onToggle: () => void;
  currentWorkspaceId: string | null;
  onEnterWorkspace: (ws: WorkspaceInfo) => void;
  addingWorkspace: boolean;
  onStartAddWorkspace: () => void;
  wsName: string;
  onWsNameChange: (v: string) => void;
  wsBranch: string;
  onWsBranchChange: (v: string) => void;
  onCreateWorkspace: () => void;
  onCancelAddWorkspace: () => void;
  loading: boolean;
}

function ProjectNode({
  project, expanded, onToggle, currentWorkspaceId, onEnterWorkspace,
  addingWorkspace, onStartAddWorkspace,
  wsName, onWsNameChange, wsBranch, onWsBranchChange, onCreateWorkspace, onCancelAddWorkspace,
  loading,
}: ProjectNodeProps) {
  const workspaces = project.workspaces.filter((w) => w.state !== 'DESTROYED');

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-1 w-full px-2 py-1 hover:bg-[var(--bg-hover)] transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <FolderOpen size={12} className="text-[var(--accent-blue)]" />
        <span className="truncate font-medium text-[var(--text-primary)]">{project.name}</span>
      </button>

      {expanded && (
        <div className="ml-3">
          {workspaces.map((ws) => (
            <WorkspaceNode
              key={ws.id}
              workspace={ws}
              isActive={ws.id === currentWorkspaceId}
              onEnter={() => onEnterWorkspace(ws)}
              disabled={loading}
            />
          ))}

          {/* New workspace inline form */}
          {addingWorkspace ? (
            <div className="mx-2 my-1 p-2 rounded bg-[var(--bg-tertiary)] space-y-1.5">
              <Input
                value={wsName}
                onChange={(e) => onWsNameChange(e.target.value)}
                placeholder="Workspace name"
                inputSize="sm"
                autoFocus
              />
              <Input
                value={wsBranch}
                onChange={(e) => onWsBranchChange(e.target.value)}
                placeholder="Branch (optional)"
                inputSize="sm"
              />
              <div className="flex gap-1.5 justify-end">
                <Button variant="ghost" size="sm" onClick={onCancelAddWorkspace}>Cancel</Button>
                <Button size="sm" onClick={onCreateWorkspace} disabled={loading || !wsName.trim()}>Create</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={onStartAddWorkspace}
              className="flex items-center gap-1.5 w-full px-4 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Plus size={10} />
              New Workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface WorkspaceNodeProps {
  workspace: WorkspaceInfo;
  isActive: boolean;
  onEnter: () => void;
  disabled: boolean;
}

function WorkspaceNode({ workspace, isActive, onEnter, disabled }: WorkspaceNodeProps) {
  const dotColor = STATE_DOT_COLOR[workspace.state] ?? 'bg-[var(--text-muted)]';
  const canEnter = workspace.state !== 'DESTROYED' && workspace.state !== 'CREATING';

  return (
    <button
      onClick={canEnter ? onEnter : undefined}
      disabled={disabled || !canEnter}
      className={cn(
        'flex items-center gap-2 w-full px-4 py-1 transition-colors text-left',
        isActive
          ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
        (!canEnter || disabled) && 'opacity-50 cursor-default',
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
      <span className="truncate">{workspace.name}</span>
    </button>
  );
}
