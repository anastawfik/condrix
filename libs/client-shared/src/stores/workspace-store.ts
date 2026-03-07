/**
 * Workspace state management.
 * Tracks current workspace, workspace list, and provides workspace operations.
 * Routes all requests through multiCoreStore for multi-Core support.
 */
import { createStore } from 'zustand/vanilla';
import type { WorkspaceInfo, ProjectInfo } from '@nexus-core/protocol';

import { multiCoreStore } from './multi-core-store.js';

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
      set({
        currentWorkspaceId: workspaceId,
        currentWorkspace: ws,
        currentCoreId: coreId ?? get().currentCoreId,
      });
    },

    createWorkspace: async (projectId, name, branch?, coreId?) => {
      const ws = await request<WorkspaceInfo>('workspace', 'create', { projectId, name, branch }, coreId);
      set((s) => ({ workspaces: [...s.workspaces, ws] }));
      return ws;
    },

    enterWorkspace: async (workspaceId, coreId?) => {
      const ws = await request<WorkspaceInfo>('workspace', 'enter', { workspaceId }, coreId);
      set((s) => ({
        currentWorkspaceId: workspaceId,
        currentWorkspace: ws,
        currentCoreId: coreId ?? resolveCoreId(coreId),
        workspaces: s.workspaces.map((w) => (w.id === workspaceId ? ws : w)),
      }));
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
