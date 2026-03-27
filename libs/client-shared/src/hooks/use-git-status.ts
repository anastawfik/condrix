/**
 * Hook for git status and operations.
 * Auto-refreshes on file:changed events from the Core.
 */
import { useStore } from 'zustand';
import { useEffect, useRef } from 'react';
import { gitStore, type GitFileChange, type DiffTab } from '../stores/git-store.js';
import { multiCoreStore } from '../stores/multi-core-store.js';
import { workspaceStore } from '../stores/workspace-store.js';

export interface UseGitStatusReturn {
  branch: string;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  diffContent: string | null;
  diffPath: string | null;
  openDiffs: DiffTab[];
  activeDiffPath: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  fetchDiff: (path?: string, staged?: boolean) => Promise<void>;
  stageFiles: (paths: string[]) => Promise<void>;
  unstageFiles: (paths: string[]) => Promise<void>;
  commit: (message: string) => Promise<void>;
  openDiffTab: (path: string, staged: boolean) => Promise<void>;
  closeDiffTab: (path: string) => void;
  setActiveDiff: (path: string | null) => void;
}

export function useGitStatus(workspaceId: string | null): UseGitStatusReturn {
  const branch = useStore(gitStore, (s) => s.branch);
  const staged = useStore(gitStore, (s) => s.staged);
  const unstaged = useStore(gitStore, (s) => s.unstaged);
  const diffContent = useStore(gitStore, (s) => s.diffContent);
  const diffPath = useStore(gitStore, (s) => s.diffPath);
  const openDiffs = useStore(gitStore, (s) => s.openDiffs);
  const activeDiffPath = useStore(gitStore, (s) => s.activeDiffPath);
  const loading = useStore(gitStore, (s) => s.loading);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (workspaceId) {
      gitStore
        .getState()
        .fetchStatus(workspaceId)
        .catch(() => {
          /* ignore */
        });
    }
  }, [workspaceId]);

  // Subscribe to file:changed events and debounce git status refresh
  useEffect(() => {
    if (!workspaceId) return;

    const coreId =
      workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
    if (!coreId) return;

    const unsub = multiCoreStore.getState().subscribeOnCore(coreId, 'file:changed', (event) => {
      const payload = event.payload as { workspaceId?: string };
      if (payload.workspaceId && payload.workspaceId !== workspaceId) return;

      // Debounce 1500ms — git status is expensive, longer debounce than tree refresh
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        gitStore
          .getState()
          .fetchStatus(workspaceId)
          .catch(() => {
            /* ignore */
          });
      }, 1500);
    });

    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [workspaceId]);

  return {
    branch,
    staged,
    unstaged,
    diffContent,
    diffPath,
    openDiffs,
    activeDiffPath,
    loading,
    refresh: async () => {
      if (workspaceId) await gitStore.getState().fetchStatus(workspaceId);
    },
    fetchDiff: async (path?: string, isStagedDiff?: boolean) => {
      if (workspaceId) await gitStore.getState().fetchDiff(workspaceId, path, isStagedDiff);
    },
    stageFiles: async (paths: string[]) => {
      if (workspaceId) {
        await gitStore.getState().stageFiles(workspaceId, paths);
        await gitStore.getState().fetchStatus(workspaceId);
      }
    },
    unstageFiles: async (paths: string[]) => {
      if (workspaceId) {
        await gitStore.getState().unstageFiles(workspaceId, paths);
        await gitStore.getState().fetchStatus(workspaceId);
      }
    },
    commit: async (message: string) => {
      if (workspaceId) {
        await gitStore.getState().commit(workspaceId, message);
        await gitStore.getState().fetchStatus(workspaceId);
      }
    },
    openDiffTab: async (path: string, isStagedDiff: boolean) => {
      if (workspaceId) await gitStore.getState().openDiffTab(workspaceId, path, isStagedDiff);
    },
    closeDiffTab: (path: string) => gitStore.getState().closeDiffTab(path),
    setActiveDiff: (path: string | null) => gitStore.getState().setActiveDiff(path),
  };
}
