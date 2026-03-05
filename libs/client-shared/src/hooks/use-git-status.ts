/**
 * Hook for git status and operations.
 */
import { useStore } from 'zustand';
import { useEffect } from 'react';
import { gitStore, type GitFileChange } from '../stores/git-store.js';

export interface UseGitStatusReturn {
  branch: string;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  diffContent: string | null;
  diffPath: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  fetchDiff: (path?: string, staged?: boolean) => Promise<void>;
  stageFiles: (paths: string[]) => Promise<void>;
  commit: (message: string) => Promise<void>;
}

export function useGitStatus(workspaceId: string | null): UseGitStatusReturn {
  const branch = useStore(gitStore, (s) => s.branch);
  const staged = useStore(gitStore, (s) => s.staged);
  const unstaged = useStore(gitStore, (s) => s.unstaged);
  const diffContent = useStore(gitStore, (s) => s.diffContent);
  const diffPath = useStore(gitStore, (s) => s.diffPath);
  const loading = useStore(gitStore, (s) => s.loading);

  useEffect(() => {
    if (workspaceId) {
      gitStore.getState().fetchStatus(workspaceId).catch(() => { /* ignore */ });
    }
  }, [workspaceId]);

  return {
    branch,
    staged,
    unstaged,
    diffContent,
    diffPath,
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
    commit: async (message: string) => {
      if (workspaceId) {
        await gitStore.getState().commit(workspaceId, message);
        await gitStore.getState().fetchStatus(workspaceId);
      }
    },
  };
}
