/**
 * Hook for file content operations — open, save, close, edit.
 */
import { useStore } from 'zustand';
import { fileStore, type OpenFile } from '../stores/file-store.js';

export interface UseFileContentReturn {
  openFiles: OpenFile[];
  activeFile: OpenFile | undefined;
  activeFilePath: string | null;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  saveFile: (path: string, content: string) => Promise<void>;
  updateContent: (path: string, content: string) => void;
}

export function useFileContent(workspaceId: string | null): UseFileContentReturn {
  const openFiles = useStore(fileStore, (s) => s.openFiles);
  const activeFilePath = useStore(fileStore, (s) => s.activeFilePath);
  const activeFile = useStore(fileStore, (s) => s.getActiveFile());

  return {
    openFiles,
    activeFile,
    activeFilePath,
    openFile: async (path: string) => {
      if (workspaceId) {
        await fileStore.getState().openFile(workspaceId, path);
      }
    },
    closeFile: (path: string) => fileStore.getState().closeFile(path),
    setActiveFile: (path: string | null) => fileStore.getState().setActiveFile(path),
    saveFile: async (path: string, content: string) => {
      if (workspaceId) {
        await fileStore.getState().saveFile(workspaceId, path, content);
      }
    },
    updateContent: (path: string, content: string) => {
      fileStore.getState().updateFileContent(path, content);
    },
  };
}
