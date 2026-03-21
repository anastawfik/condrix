import { useStore } from 'zustand';
import { MessageSquare, GitCompareArrows, X, Loader2 } from 'lucide-react';
import { workspaceStore, useFileContent, gitStore, fileStore } from '@nexus-core/client-shared';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
} from '@nexus-core/client-components';
import type { WorkspaceInfo } from '@nexus-core/protocol';
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { EditorTab } from './editor-tab.js';
import { ChatPanel } from '../chat/chat-panel.js';

// Lazy-load Monaco editor components to reduce main bundle size
const CodeEditor = lazy(() => import('./code-editor.js').then((m) => ({ default: m.CodeEditor })));
const DiffEditor = lazy(() => import('./diff-editor.js').then((m) => ({ default: m.DiffEditor })));

export type ActiveView = 'chat' | 'editor' | 'diff';

/** localStorage key for persisted UI state */
const UI_STATE_KEY = 'nexus-ui-state';

export function EditorTabs() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const workspaces = useStore(workspaceStore, (s) => s.workspaces);
  const enteredWorkspaceIds = useStore(workspaceStore, (s) => s.enteredWorkspaceIds);
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useFileContent(workspaceId);
  const openDiffs = useStore(gitStore, (s) => s.openDiffs) ?? [];
  const activeDiffPath = useStore(gitStore, (s) => s.activeDiffPath) ?? null;

  // Resolve entered workspace info for chat tabs
  const enteredWorkspaces = useMemo(() => {
    const wsMap = new Map(workspaces.map((w) => [w.id, w]));
    return enteredWorkspaceIds
      .map((id) => wsMap.get(id))
      .filter((w): w is WorkspaceInfo => w != null);
  }, [workspaces, enteredWorkspaceIds]);

  // Restore activeView from localStorage, default to 'chat'
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    try {
      const saved = localStorage.getItem(UI_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeView === 'chat' || parsed.activeView === 'editor' || parsed.activeView === 'diff') return parsed.activeView;
      }
    } catch { /* ignore */ }
    return 'chat';
  });

  // Auto-switch to editor view when a file becomes active (e.g. clicked in explorer)
  useEffect(() => {
    if (activeFilePath) {
      setActiveView('editor');
    }
  }, [activeFilePath]);

  // Auto-switch to diff view when a diff tab becomes active
  useEffect(() => {
    if (activeDiffPath) {
      setActiveView('diff');
    }
  }, [activeDiffPath]);

  // Persist activeView to localStorage
  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem(UI_STATE_KEY) ?? '{}');
      existing.activeView = activeView;
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(existing));
    } catch { /* ignore */ }
  }, [activeView]);

  const handleFileSelect = (path: string) => {
    setActiveFile(path);
    setActiveView('editor');
  };

  const handleDiffSelect = (path: string) => {
    gitStore.getState().setActiveDiff(path);
    setActiveView('diff');
  };

  const handleDiffClose = (path: string) => {
    gitStore.getState().closeDiffTab(path);
    // If no more diffs, switch back to editor or chat
    const remaining = gitStore.getState().openDiffs;
    if (remaining.length === 0 && activeView === 'diff') {
      setActiveView(openFiles.length > 0 ? 'editor' : 'chat');
    }
  };

  const handleChatSelect = (wsId?: string) => {
    if (wsId) {
      workspaceStore.getState().setCurrentWorkspace(wsId);
    }
    setActiveView('chat');
  };

  const handleCloseOthers = useCallback((path: string) => {
    const { openFiles: files } = fileStore.getState();
    for (const f of files) {
      if (f.path !== path) closeFile(f.path);
    }
  }, [closeFile]);

  const handleCloseAll = useCallback(() => {
    const { openFiles: files } = fileStore.getState();
    for (const f of files) closeFile(f.path);
    setActiveView('chat');
  }, [closeFile]);

  const handleCloseAllDiffs = useCallback(() => {
    for (const d of openDiffs) gitStore.getState().closeDiffTab(d.path);
    if (activeView === 'diff') setActiveView(openFiles.length > 0 ? 'editor' : 'chat');
  }, [openDiffs, activeView, openFiles.length]);

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(() => {});
  }, []);

  const fileName = (path: string) => path.split('/').pop() ?? path;

  // Derive a short name for a workspace chat tab
  const wsTabName = (ws: WorkspaceInfo) => ws.name || ws.id.slice(0, 8);

  return (
    <div className="flex flex-col h-full" data-testid="editor-tabs">
      <div className="flex items-center bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] overflow-x-auto shrink-0" data-testid="tab-bar">
        {enteredWorkspaces.length > 0 ? (
          enteredWorkspaces.map((ws) => (
            <button
              key={`chat:${ws.id}`}
              onClick={() => handleChatSelect(ws.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-[var(--border-color)] ${
                activeView === 'chat' && workspaceId === ws.id
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent-blue)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-t-2 border-t-transparent hover:bg-[var(--bg-hover)]'
              }`}
            >
              <MessageSquare size={12} />
              <span className="truncate max-w-[120px]">{wsTabName(ws)}</span>
            </button>
          ))
        ) : (
          <button
            onClick={() => handleChatSelect()}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-[var(--border-color)] ${
              activeView === 'chat'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent-blue)]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-t-2 border-t-transparent hover:bg-[var(--bg-hover)]'
            }`}
          >
            <MessageSquare size={12} />
            Chat
          </button>
        )}

        {openFiles.map((file) => (
          <EditorTab
            key={file.path}
            file={file}
            isActive={activeView === 'editor' && activeFilePath === file.path}
            onSelect={() => handleFileSelect(file.path)}
            onClose={() => closeFile(file.path)}
            onCloseOthers={() => handleCloseOthers(file.path)}
            onCloseAll={handleCloseAll}
            onCopyPath={() => handleCopyPath(file.path)}
          />
        ))}

        {openDiffs.map((diff) => (
          <ContextMenu key={`diff:${diff.path}`}>
            <ContextMenuTrigger asChild>
              <div
                onClick={() => handleDiffSelect(diff.path)}
                role="tab"
                aria-selected={activeView === 'diff' && activeDiffPath === diff.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-[var(--border-color)] group cursor-pointer ${
                  activeView === 'diff' && activeDiffPath === diff.path
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent-green)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-t-2 border-t-transparent hover:bg-[var(--bg-hover)]'
                }`}
              >
                <GitCompareArrows size={12} className="text-[var(--accent-green)] shrink-0" />
                <span className="truncate max-w-[120px]">{fileName(diff.path)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDiffClose(diff.path); }}
                  aria-label={`Close diff ${fileName(diff.path)}`}
                  className="p-0.5 rounded hover:bg-[var(--bg-active)] opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => handleDiffClose(diff.path)}>Close</ContextMenuItem>
              <ContextMenuItem onClick={handleCloseAllDiffs}>Close All Diffs</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeView === 'chat' && <ChatPanel />}
        {activeView === 'editor' && (
          <Suspense fallback={<EditorLoading />}>
            <CodeEditor />
          </Suspense>
        )}
        {activeView === 'diff' && (
          <Suspense fallback={<EditorLoading />}>
            <DiffEditor />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function EditorLoading() {
  return (
    <div className="flex items-center justify-center gap-2 h-full bg-[var(--bg-primary)] text-[var(--text-muted)]">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">Loading editor...</span>
    </div>
  );
}
