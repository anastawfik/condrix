/**
 * Git state management.
 * Tracks repository status, staged/unstaged files, and diff content.
 */
import { createStore } from 'zustand/vanilla';

import { multiCoreStore } from './multi-core-store.js';
import { workspaceStore } from './workspace-store.js';

export interface GitFileChange {
  path: string;
  status: string; // M, A, D, R, ?, etc.
  staged: boolean;
}

export interface GitStore {
  branch: string;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  diffContent: string | null;
  diffPath: string | null;
  loading: boolean;

  fetchStatus: (workspaceId: string) => Promise<void>;
  fetchDiff: (workspaceId: string, path?: string, staged?: boolean) => Promise<void>;
  stageFiles: (workspaceId: string, paths: string[]) => Promise<void>;
  commit: (workspaceId: string, message: string) => Promise<void>;
}

export const createGitStore = () =>
  createStore<GitStore>((set) => ({
    branch: '',
    staged: [],
    unstaged: [],
    diffContent: null,
    diffPath: null,
    loading: false,

    fetchStatus: async (workspaceId) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      set({ loading: true });
      try {
        const result = await multiCoreStore.getState().requestOnCore<{
          branch: string;
          files: { path: string; index: string; working_dir: string }[];
        }>(coreId, 'git', 'status', { workspaceId });

        const staged: GitFileChange[] = [];
        const unstaged: GitFileChange[] = [];

        for (const file of result.files ?? []) {
          if (file.index && file.index !== ' ' && file.index !== '?') {
            staged.push({ path: file.path, status: file.index, staged: true });
          }
          if (file.working_dir && file.working_dir !== ' ') {
            unstaged.push({ path: file.path, status: file.working_dir, staged: false });
          }
        }

        set({ branch: result.branch ?? '', staged, unstaged });
      } finally {
        set({ loading: false });
      }
    },

    fetchDiff: async (workspaceId, path, staged) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      const result = await multiCoreStore.getState().requestOnCore<{ diff: string }>(
        coreId, 'git', 'diff', { workspaceId, path, staged },
      );
      set({ diffContent: result.diff, diffPath: path ?? null });
    },

    stageFiles: async (workspaceId, paths) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      await multiCoreStore.getState().requestOnCore(coreId, 'git', 'stage', { workspaceId, paths });
    },

    commit: async (workspaceId, message) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      await multiCoreStore.getState().requestOnCore(coreId, 'git', 'commit', { workspaceId, message });
    },
  }));

export const gitStore = createGitStore();
