/**
 * Hook for file tree operations — fetch, expand, collapse.
 * Auto-refreshes on file:changed events from the Core.
 */
import { useStore } from 'zustand';
import { useEffect, useRef } from 'react';
import { fileStore, type FileNode } from '../stores/file-store.js';
import { multiCoreStore } from '../stores/multi-core-store.js';
import { workspaceStore } from '../stores/workspace-store.js';

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (workspaceId) {
      fileStore.getState().fetchTree(workspaceId).catch(() => { /* ignore */ });
    }
  }, [workspaceId]);

  // Subscribe to file:changed events and debounce tree refresh
  useEffect(() => {
    if (!workspaceId) return;

    const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
    if (!coreId) return;

    const unsub = multiCoreStore.getState().subscribeOnCore(coreId, 'file:changed', (event) => {
      const payload = event.payload as { workspaceId?: string };
      if (payload.workspaceId && payload.workspaceId !== workspaceId) return;

      // Debounce 500ms — batch operations like npm install generate hundreds of events
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fileStore.getState().fetchTree(workspaceId).catch(() => { /* ignore */ });
      }, 500);
    });

    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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
