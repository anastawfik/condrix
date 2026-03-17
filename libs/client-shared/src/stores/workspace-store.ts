/**
 * Workspace state management.
 * Tracks current workspace, workspace list, and provides workspace operations.
 * Routes all requests through multiCoreStore for multi-Core support.
 */
import { createStore } from 'zustand/vanilla';
import type { WorkspaceInfo, ProjectInfo } from '@nexus-core/protocol';

import { multiCoreStore } from './multi-core-store.js';
import { maestroStore } from './maestro-store.js';

const UI_STATE_KEY = 'nexus-ui-state';

function saveWorkspaceUIState(coreId: string | null, projectId: string | null, workspaceId: string | null): void {
  try {
    const existing = JSON.parse(localStorage.getItem(UI_STATE_KEY) ?? '{}');
    existing.activeCoreId = coreId;
    existing.currentProjectId = projectId;
    existing.currentWorkspaceId = workspaceId;
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

export function getSavedUIState(): { activeCoreId?: string; currentProjectId?: string; currentWorkspaceId?: string; activeView?: string } {
  try {
    return JSON.parse(localStorage.getItem(UI_STATE_KEY) ?? '{}');
  } catch { return {}; }
}

/** Helper: get coreId to use — explicit or active. */
function resolveCoreId(explicit?: string): string {
  const coreId = explicit ?? multiCoreStore.getState().activeCoreId;
  if (!coreId) throw new Error('No active Core connection');
  return coreId;
}

async function request<T>(ns: string, action: string, payload: unknown, coreId?: string): Promise<T> {
  return multiCoreStore.getState().requestOnCore<T>(resolveCoreId(coreId), ns, action, payload);
}

export interface WorkspaceStore {
  projects: ProjectInfo[];
  workspaces: WorkspaceInfo[];
  currentCoreId: string | null;
  currentProjectId: string | null;
  currentWorkspaceId: string | null;
  currentWorkspace: WorkspaceInfo | null;
  /** Workspace IDs that have been entered this session (for multi-tab chat). */
  enteredWorkspaceIds: string[];

  // Project operations
  fetchProjects: (coreId?: string) => Promise<void>;
  createProject: (name: string, opts: { path?: string; url?: string }, coreId?: string) => Promise<ProjectInfo>;
  deleteProject: (projectId: string, coreId?: string) => Promise<void>;
  setCurrentProject: (projectId: string | null) => void;

  // Workspace operations
  fetchWorkspaces: (projectId?: string, coreId?: string) => Promise<void>;
  setCurrentWorkspace: (workspaceId: string | null, coreId?: string) => void;
  createWorkspace: (projectId: string, name: string, branch?: string, coreId?: string) => Promise<WorkspaceInfo>;
  enterWorkspace: (workspaceId: string, coreId?: string) => Promise<void>;
  suspendWorkspace: (workspaceId: string, coreId?: string) => Promise<void>;
  resumeWorkspace: (workspaceId: string, coreId?: string) => Promise<void>;
  destroyWorkspace: (workspaceId: string, coreId?: string) => Promise<void>;
}

export const createWorkspaceStore = () =>
  createStore<WorkspaceStore>((set, get) => ({
    projects: [],
    workspaces: [],
    currentCoreId: null,
    currentProjectId: null,
    currentWorkspaceId: null,
    currentWorkspace: null,
    enteredWorkspaceIds: [],

    fetchProjects: async (coreId?) => {
      const result = await request<{ projects: ProjectInfo[] }>('project', 'list', {}, coreId);
      set({ projects: result.projects });
    },

    createProject: async (name, opts, coreId?) => {
      const project = await request<ProjectInfo>('project', 'create', { name, ...opts }, coreId);
      set((s) => ({ projects: [...s.projects, project] }));
      return project;
    },

    deleteProject: async (projectId, coreId?) => {
      await request('project', 'delete', { projectId }, coreId);
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== projectId),
        currentProjectId: s.currentProjectId === projectId ? null : s.currentProjectId,
      }));
    },

    setCurrentProject: (projectId) => {
      set({ currentProjectId: projectId });
      saveWorkspaceUIState(get().currentCoreId, projectId, get().currentWorkspaceId);
    },

    fetchWorkspaces: async (projectId?, coreId?) => {
      const result = await request<{ workspaces: WorkspaceInfo[] }>(
        'workspace', 'list', projectId ? { projectId } : {}, coreId,
      );
      set({ workspaces: result.workspaces });
      const { currentWorkspaceId } = get();
      if (currentWorkspaceId) {
        const ws = result.workspaces.find((w) => w.id === currentWorkspaceId);
        if (ws) set({ currentWorkspace: ws });
      }
    },

    setCurrentWorkspace: (workspaceId, coreId?) => {
      const ws = workspaceId ? get().workspaces.find((w) => w.id === workspaceId) ?? null : null;
      const resolvedCoreId = coreId ?? get().currentCoreId;
      set({
        currentWorkspaceId: workspaceId,
        currentWorkspace: ws,
        currentCoreId: resolvedCoreId,
      });
      saveWorkspaceUIState(resolvedCoreId, get().currentProjectId, workspaceId);
    },

    createWorkspace: async (projectId, name, branch?, coreId?) => {
      const ws = await request<WorkspaceInfo>('workspace', 'create', { projectId, name, branch }, coreId);
      set((s) => ({ workspaces: [...s.workspaces, ws] }));
      return ws;
    },

    enterWorkspace: async (workspaceId, coreId?) => {
      const ws = await request<WorkspaceInfo>('workspace', 'enter', { workspaceId }, coreId);
      const resolvedCoreId = coreId ?? resolveCoreId(coreId);
      set((s) => ({
        currentWorkspaceId: workspaceId,
        currentWorkspace: ws,
        currentCoreId: resolvedCoreId,
        workspaces: s.workspaces.map((w) => (w.id === workspaceId ? ws : w)),
        enteredWorkspaceIds: s.enteredWorkspaceIds.includes(workspaceId)
          ? s.enteredWorkspaceIds
          : [...s.enteredWorkspaceIds, workspaceId],
      }));
      saveWorkspaceUIState(resolvedCoreId, get().currentProjectId, workspaceId);
    },

    suspendWorkspace: async (workspaceId, coreId?) => {
      const ws = await request<WorkspaceInfo>('workspace', 'suspend', { workspaceId }, coreId);
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === workspaceId ? ws : w)),
        currentWorkspaceId: s.currentWorkspaceId === workspaceId ? null : s.currentWorkspaceId,
        currentWorkspace: s.currentWorkspaceId === workspaceId ? null : s.currentWorkspace,
      }));
    },

    resumeWorkspace: async (workspaceId, coreId?) => {
      const ws = await request<WorkspaceInfo>('workspace', 'resume', { workspaceId }, coreId);
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === workspaceId ? ws : w)),
      }));
    },

    destroyWorkspace: async (workspaceId, coreId?) => {
      await request('workspace', 'destroy', { workspaceId }, coreId);
      set((s) => ({
        workspaces: s.workspaces.filter((w) => w.id !== workspaceId),
        currentWorkspaceId: s.currentWorkspaceId === workspaceId ? null : s.currentWorkspaceId,
        currentWorkspace: s.currentWorkspaceId === workspaceId ? null : s.currentWorkspace,
      }));
    },
  }));

export const workspaceStore = createWorkspaceStore();

// Save workspace UI state on page unload as safety net
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const { currentCoreId, currentProjectId, currentWorkspaceId } = workspaceStore.getState();
    saveWorkspaceUIState(currentCoreId, currentProjectId, currentWorkspaceId);
  });
}

/** Guard against duplicate initWorkspaceSync calls (e.g. HMR re-evaluation). */
let _workspaceSyncCleanup: (() => void) | null = null;

/**
 * Auto-subscribe to workspace broadcast events whenever a Core connects.
 * Keeps workspace list in sync across multiple clients.
 * Call once at app startup (mirrors initChatSync / initTerminalSync pattern).
 */
export function initWorkspaceSync(): () => void {
  if (_workspaceSyncCleanup) {
    _workspaceSyncCleanup();
    _workspaceSyncCleanup = null;
  }
  const connectedCores = new Set<string>();
  const unsubs = new Map<string, Array<() => void>>();

  const workspaceEventHandler = () => {
    const { currentProjectId } = workspaceStore.getState();
    workspaceStore.getState().fetchWorkspaces(currentProjectId ?? undefined).catch(() => {});
  };

  // Direct mode: subscribe via multiCoreStore connections
  const unsub = multiCoreStore.subscribe((state) => {
    for (const [coreId, conn] of state.connections) {
      if (conn.connState === 'connected' && !connectedCores.has(coreId)) {
        connectedCores.add(coreId);
        const coreUnsubs: Array<() => void> = [];
        const sub = (pattern: string) =>
          multiCoreStore.getState().subscribeOnCore(coreId, pattern, workspaceEventHandler);
        coreUnsubs.push(sub('workspace:created'));
        coreUnsubs.push(sub('workspace:stateChanged'));
        coreUnsubs.push(sub('workspace:destroyed'));
        unsubs.set(coreId, coreUnsubs);
      }
    }
    for (const coreId of connectedCores) {
      if (!state.connections.has(coreId)) {
        connectedCores.delete(coreId);
        const coreUnsubs = unsubs.get(coreId);
        if (coreUnsubs) { for (const u of coreUnsubs) u(); unsubs.delete(coreId); }
      }
    }
  });

  // Maestro mode: subscribe via maestroStore when connected
  let maestroEventUnsubs: Array<() => void> = [];
  const setupMaestroSubs = () => {
    const sub = maestroStore.getState().subscribe;
    maestroEventUnsubs.push(sub('workspace:created', workspaceEventHandler));
    maestroEventUnsubs.push(sub('workspace:stateChanged', workspaceEventHandler));
    maestroEventUnsubs.push(sub('workspace:destroyed', workspaceEventHandler));
  };
  const maestroUnsub = maestroStore.subscribe((state) => {
    if (state.state === 'connected' && maestroEventUnsubs.length === 0) {
      setupMaestroSubs();
    } else if (state.state !== 'connected' && maestroEventUnsubs.length > 0) {
      for (const u of maestroEventUnsubs) u();
      maestroEventUnsubs = [];
    }
  });
  if (maestroStore.getState().state === 'connected') {
    setupMaestroSubs();
  }

  const cleanup = () => { unsub(); maestroUnsub(); for (const u of maestroEventUnsubs) u(); };
  _workspaceSyncCleanup = cleanup;
  return cleanup;
}
