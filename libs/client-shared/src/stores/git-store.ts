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

export interface DiffTab {
  path: string;
  staged: boolean;
  diff: string;
}

export interface GitStore {
  branch: string;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  diffContent: string | null;
  diffPath: string | null;
  loading: boolean;

  /** Diff tabs shown in the center column */
  openDiffs: DiffTab[];
  activeDiffPath: string | null;

  fetchStatus: (workspaceId: string) => Promise<void>;
  fetchDiff: (workspaceId: string, path?: string, staged?: boolean) => Promise<void>;
  stageFiles: (workspaceId: string, paths: string[]) => Promise<void>;
  unstageFiles: (workspaceId: string, paths: string[]) => Promise<void>;
  commit: (workspaceId: string, message: string) => Promise<void>;
  openDiffTab: (workspaceId: string, path: string, staged: boolean) => Promise<void>;
  closeDiffTab: (path: string) => void;
  setActiveDiff: (path: string | null) => void;
}

export const createGitStore = () =>
  createStore<GitStore>((set, get) => ({
    branch: '',
    staged: [],
    unstaged: [],
    diffContent: null,
    diffPath: null,
    loading: false,
    openDiffs: [],
    activeDiffPath: null,

    fetchStatus: async (workspaceId) => {
      const coreId =
        workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      set({ loading: true });
      try {
        const result = await multiCoreStore.getState().requestOnCore<{
          branch: string;
          clean: boolean;
          entries: { path: string; status: string; staged: boolean }[];
        }>(coreId, 'git', 'status', { workspaceId });

        const staged: GitFileChange[] = [];
        const unstaged: GitFileChange[] = [];

        for (const entry of result.entries ?? []) {
          // Map Core's descriptive status to short git codes for UI
          const code = statusToCode(entry.status);
          if (entry.staged) {
            staged.push({ path: entry.path, status: code, staged: true });
          } else {
            unstaged.push({ path: entry.path, status: code, staged: false });
          }
        }

        set({ branch: result.branch ?? '', staged, unstaged });
      } finally {
        set({ loading: false });
      }
    },

    fetchDiff: async (workspaceId, path, staged) => {
      const coreId =
        workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      const result = await multiCoreStore
        .getState()
        .requestOnCore<{ diff: string }>(coreId, 'git', 'diff', { workspaceId, path, staged });
      set({ diffContent: result.diff, diffPath: path ?? null });
    },

    stageFiles: async (workspaceId, paths) => {
      const coreId =
        workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      await multiCoreStore.getState().requestOnCore(coreId, 'git', 'stage', { workspaceId, paths });
    },

    commit: async (workspaceId, message) => {
      const coreId =
        workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      await multiCoreStore
        .getState()
        .requestOnCore(coreId, 'git', 'commit', { workspaceId, message });
    },

    unstageFiles: async (workspaceId, paths) => {
      const coreId =
        workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      await multiCoreStore
        .getState()
        .requestOnCore(coreId, 'git', 'unstage', { workspaceId, paths });
    },

    openDiffTab: async (workspaceId, path, staged) => {
      const coreId =
        workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      const result = await multiCoreStore
        .getState()
        .requestOnCore<{ diff: string }>(coreId, 'git', 'diff', { workspaceId, path, staged });
      const existing = get().openDiffs;
      const idx = existing.findIndex((d) => d.path === path);
      const tab: DiffTab = { path, staged, diff: result.diff };
      if (idx >= 0) {
        const updated = [...existing];
        updated[idx] = tab;
        set({ openDiffs: updated, activeDiffPath: path });
      } else {
        set({ openDiffs: [...existing, tab], activeDiffPath: path });
      }
    },

    closeDiffTab: (path) => {
      set((s) => {
        const newDiffs = s.openDiffs.filter((d) => d.path !== path);
        const newActive =
          s.activeDiffPath === path
            ? newDiffs.length > 0
              ? newDiffs[newDiffs.length - 1].path
              : null
            : s.activeDiffPath;
        return { openDiffs: newDiffs, activeDiffPath: newActive };
      });
    },

    setActiveDiff: (path) => set({ activeDiffPath: path }),
  }));

/** Map descriptive status from Core's GitTracker to short codes. */
function statusToCode(status: string): string {
  switch (status) {
    case 'modified':
      return 'M';
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'untracked':
      return '?';
    default:
      return status.charAt(0).toUpperCase();
  }
}

export const gitStore = createGitStore();
