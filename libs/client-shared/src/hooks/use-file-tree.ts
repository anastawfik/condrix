/**
 * Hook for file tree operations — fetch, expand, collapse.
 */
import { useStore } from 'zustand';
import { useEffect } from 'react';
import { fileStore, type FileNode } from '../stores/file-store.js';

export interface UseFileTreeReturn {
  tree: FileNode[];
  loading: boolean;
  expandNode: (path: string) => Promise<void>;
  collapseNode: (path: string) => void;
  refresh: () => Promise<void>;
}

export function useFileTree(workspaceId: string | null): UseFileTreeReturn {
  const tree = useStore(fileStore, (s) => s.tree);
  const loading = useStore(fileStore, (s) => s.treeLoading);

  useEffect(() => {
    if (workspaceId) {
      fileStore.getState().fetchTree(workspaceId).catch(() => { /* ignore */ });
    }
  }, [workspaceId]);

  return {
    tree,
    loading,
    expandNode: async (path: string) => {
      if (workspaceId) {
        await fileStore.getState().expandNode(workspaceId, path);
      }
    },
    collapseNode: (path: string) => fileStore.getState().collapseNode(path),
    refresh: async () => {
      if (workspaceId) {
        await fileStore.getState().fetchTree(workspaceId);
      }
    },
  };
}
