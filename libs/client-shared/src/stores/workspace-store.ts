/**
 * Workspace state management.
 * Tracks current workspace, workspace list, and provides workspace operations.
 */
import { createStore } from 'zustand/vanilla';
import type { WorkspaceInfo, ProjectInfo } from '@nexus-core/protocol';

import { connectionStore } from './connection-store.js';

export interface WorkspaceStore {
  projects: ProjectInfo[];
  workspaces: WorkspaceInfo[];
  currentWorkspaceId: string | null;
  currentWorkspace: WorkspaceInfo | null;

  fetchProjects: () => Promise<void>;
  fetchWorkspaces: (projectId?: string) => Promise<void>;
  setCurrentWorkspace: (workspaceId: string | null) => void;
  createWorkspace: (projectId: string, name: string, branch?: string) => Promise<WorkspaceInfo>;
  enterWorkspace: (workspaceId: string) => Promise<void>;
}

export const createWorkspaceStore = () =>
  createStore<WorkspaceStore>((set, get) => ({
    projects: [],
    workspaces: [],
    currentWorkspaceId: null,
    currentWorkspace: null,

    fetchProjects: async () => {
      const conn = connectionStore.getState();
      const result = await conn.request<{ projects: ProjectInfo[] }>('project', 'list', {});
      set({ projects: result.projects });
    },

    fetchWorkspaces: async (projectId) => {
      const conn = connectionStore.getState();
      const result = await conn.request<{ workspaces: WorkspaceInfo[] }>(
        'workspace', 'list', projectId ? { projectId } : {},
      );
      set({ workspaces: result.workspaces });
      // Update current workspace info if it's in the list
      const { currentWorkspaceId } = get();
      if (currentWorkspaceId) {
        const ws = result.workspaces.find((w) => w.id === currentWorkspaceId);
        if (ws) set({ currentWorkspace: ws });
      }
    },

    setCurrentWorkspace: (workspaceId) => {
      const ws = workspaceId ? get().workspaces.find((w) => w.id === workspaceId) ?? null : null;
      set({ currentWorkspaceId: workspaceId, currentWorkspace: ws });
    },

    createWorkspace: async (projectId, name, branch) => {
      const conn = connectionStore.getState();
      const ws = await conn.request<WorkspaceInfo>('workspace', 'create', { projectId, name, branch });
      set((s) => ({ workspaces: [...s.workspaces, ws] }));
      return ws;
    },

    enterWorkspace: async (workspaceId) => {
      const conn = connectionStore.getState();
      const ws = await conn.request<WorkspaceInfo>('workspace', 'enter', { workspaceId });
      set((s) => ({
        currentWorkspaceId: workspaceId,
        currentWorkspace: ws,
        workspaces: s.workspaces.map((w) => (w.id === workspaceId ? ws : w)),
      }));
    },
  }));

export const workspaceStore = createWorkspaceStore();
