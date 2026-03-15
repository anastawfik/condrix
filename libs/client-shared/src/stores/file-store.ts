/**
 * File state management.
 * Tracks file tree nodes, open files, and the active editor tab.
 */
import { createStore } from 'zustand/vanilla';

import { multiCoreStore } from './multi-core-store.js';
import { workspaceStore } from './workspace-store.js';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
  loading?: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  dirty: boolean;
}

export interface FileStore {
  tree: FileNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  treeLoading: boolean;

  fetchTree: (workspaceId: string, path?: string) => Promise<FileNode[]>;
  expandNode: (workspaceId: string, path: string) => Promise<void>;
  collapseNode: (path: string) => void;
  openFile: (workspaceId: string, path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  saveFile: (workspaceId: string, path: string, content: string) => Promise<void>;
  updateFileContent: (path: string, content: string) => void;
  getActiveFile: () => OpenFile | undefined;
  restoreUIState: (workspaceId: string) => Promise<void>;
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    json: 'json', md: 'markdown', css: 'css', html: 'html', scss: 'scss',
    py: 'python', rs: 'rust', go: 'go', yaml: 'yaml', yml: 'yaml',
    toml: 'toml', sh: 'shell', bash: 'shell', sql: 'sql', graphql: 'graphql',
  };
  return map[ext] ?? 'plaintext';
}

const UI_STATE_KEY = 'nexus-ui-state';
let saveDebounce: ReturnType<typeof setTimeout> | null = null;

function saveFileUIState(openFiles: OpenFile[], activeFilePath: string | null): void {
  if (saveDebounce) clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    try {
      const existing = JSON.parse(localStorage.getItem(UI_STATE_KEY) ?? '{}');
      existing.openFiles = openFiles.map((f) => f.path);
      existing.activeFilePath = activeFilePath;
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(existing));
    } catch { /* ignore */ }
  }, 1000);
}

export const createFileStore = () =>
  createStore<FileStore>((set, get) => ({
    tree: [],
    openFiles: [],
    activeFilePath: null,
    treeLoading: false,

    fetchTree: async (workspaceId, path) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return [];
      set({ treeLoading: true });
      try {
        const result = await multiCoreStore.getState().requestOnCore<{ entries: FileNode[] }>(
          coreId, 'file', 'tree', { workspaceId, path, depth: 1 },
        );
        if (!path) {
          set({ tree: result.entries });
        }
        return result.entries;
      } finally {
        set({ treeLoading: false });
      }
    },

    expandNode: async (workspaceId, path) => {
      // Mark node as loading
      set({ tree: updateNode(get().tree, path, { expanded: true, loading: true }) });
      try {
        const children = await get().fetchTree(workspaceId, path);
        set({ tree: updateNode(get().tree, path, { children, loading: false }) });
      } catch {
        set({ tree: updateNode(get().tree, path, { loading: false }) });
      }
    },

    collapseNode: (path) => {
      set({ tree: updateNode(get().tree, path, { expanded: false }) });
    },

    openFile: async (workspaceId, path) => {
      // Check if already open
      const existing = get().openFiles.find((f) => f.path === path);
      if (existing) {
        set({ activeFilePath: path });
        return;
      }

      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) throw new Error('No active Core connection');
      const result = await multiCoreStore.getState().requestOnCore<{ path: string; content: string }>(
        coreId, 'file', 'read', { workspaceId, path },
      );

      const name = path.split('/').pop() ?? path;
      const file: OpenFile = {
        path,
        name,
        content: result.content,
        language: detectLanguage(path),
        dirty: false,
      };

      set((s) => ({
        openFiles: [...s.openFiles, file],
        activeFilePath: path,
      }));
      saveFileUIState(get().openFiles, path);
    },

    closeFile: (path) => {
      set((s) => {
        const newFiles = s.openFiles.filter((f) => f.path !== path);
        const newActive = s.activeFilePath === path
          ? (newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null)
          : s.activeFilePath;
        return { openFiles: newFiles, activeFilePath: newActive };
      });
      saveFileUIState(get().openFiles, get().activeFilePath);
    },

    setActiveFile: (path) => {
      set({ activeFilePath: path });
      saveFileUIState(get().openFiles, path);
    },

    saveFile: async (workspaceId, path, content) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) throw new Error('No active Core connection');
      await multiCoreStore.getState().requestOnCore(coreId, 'file', 'write', { workspaceId, path, content });
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path ? { ...f, content, dirty: false } : f,
        ),
      }));
    },

    updateFileContent: (path, content) => {
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path ? { ...f, content, dirty: true } : f,
        ),
      }));
    },

    getActiveFile: () => {
      const { openFiles, activeFilePath } = get();
      return openFiles.find((f) => f.path === activeFilePath);
    },

    restoreUIState: async (workspaceId) => {
      try {
        const saved = JSON.parse(localStorage.getItem(UI_STATE_KEY) ?? '{}');
        const paths: string[] = saved.openFiles ?? [];
        const activePath: string | null = saved.activeFilePath ?? null;

        // Open each saved file (sequentially to avoid race conditions)
        for (const path of paths) {
          try {
            await get().openFile(workspaceId, path);
          } catch { /* file may no longer exist */ }
        }

        // Restore active file selection
        if (activePath && get().openFiles.some((f) => f.path === activePath)) {
          set({ activeFilePath: activePath });
        }
      } catch { /* ignore corrupt state */ }
    },
  }));

function updateNode(nodes: FileNode[], path: string, updates: Partial<FileNode>): FileNode[] {
  return nodes.map((node) => {
    if (node.path === path) {
      return { ...node, ...updates };
    }
    if (node.children) {
      return { ...node, children: updateNode(node.children, path, updates) };
    }
    return node;
  });
}

export const fileStore = createFileStore();

// Save UI state on page unload as safety net
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const { openFiles, activeFilePath } = fileStore.getState();
    try {
      const existing = JSON.parse(localStorage.getItem(UI_STATE_KEY) ?? '{}');
      existing.openFiles = openFiles.map((f) => f.path);
      existing.activeFilePath = activeFilePath;
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(existing));
    } catch { /* ignore */ }
  });
}
