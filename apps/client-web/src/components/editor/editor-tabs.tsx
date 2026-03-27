import { useStore } from 'zustand';
import { MessageSquare, GitCompareArrows, X } from 'lucide-react';
import {
  workspaceStore,
  useFileContent,
  gitStore,
  fileStore,
  chatStore,
} from '@condrix/client-shared';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import type { WorkspaceInfo } from '@condrix/protocol';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { EditorTab } from './editor-tab.js';
import { CodeEditor } from './code-editor.js';
import { ChatPanel } from '../chat/chat-panel.js';
import { DiffEditor } from './diff-editor.js';

export type ActiveView = 'chat' | 'editor' | 'diff';

/** localStorage key for persisted UI state */
const UI_STATE_KEY = 'condrix-ui-state';

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
        if (
          parsed.activeView === 'chat' ||
          parsed.activeView === 'editor' ||
          parsed.activeView === 'diff'
        )
          return parsed.activeView;
      }
    } catch {
      /* ignore */
    }
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
    } catch {
      /* ignore */
    }
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

  const handleCloseOthers = useCallback(
    (path: string) => {
      const { openFiles: files } = fileStore.getState();
      for (const f of files) {
        if (f.path !== path) closeFile(f.path);
      }
    },
    [closeFile],
  );

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
  const streamingWorkspaces = useStore(chatStore, (s) => s.streamingWorkspaces);
  const wsTabName = (ws: WorkspaceInfo) => ws.name || ws.id.slice(0, 8);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center bg-secondary border-b border-border overflow-x-auto shrink-0">
        {enteredWorkspaces.length > 0 ? (
          enteredWorkspaces.map((ws) => (
            <button
              key={`chat:${ws.id}`}
              onClick={() => handleChatSelect(ws.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border ${
                activeView === 'chat' && workspaceId === ws.id
                  ? 'bg-background text-foreground border-t-2 border-t-primary'
                  : 'bg-secondary text-muted-foreground border-t-2 border-t-transparent hover:bg-accent'
              }`}
            >
              <MessageSquare size={12} />
              <span className="truncate max-w-[120px]">{wsTabName(ws)}</span>
              {streamingWorkspaces.has(ws.id) && (
                <span
                  className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"
                  title="Agent working..."
                />
              )}
            </button>
          ))
        ) : (
          <button
            onClick={() => handleChatSelect()}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border ${
              activeView === 'chat'
                ? 'bg-background text-foreground border-t-2 border-t-primary'
                : 'bg-secondary text-muted-foreground border-t-2 border-t-transparent hover:bg-accent'
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border group cursor-pointer ${
                  activeView === 'diff' && activeDiffPath === diff.path
                    ? 'bg-background text-foreground border-t-2 border-t-success'
                    : 'bg-secondary text-muted-foreground border-t-2 border-t-transparent hover:bg-accent'
                }`}
              >
                <GitCompareArrows size={12} className="text-success shrink-0" />
                <span className="truncate max-w-[120px]">{fileName(diff.path)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDiffClose(diff.path);
                  }}
                  aria-label={`Close diff ${fileName(diff.path)}`}
                  className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 shrink-0"
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
        {activeView === 'editor' && <CodeEditor />}
        {activeView === 'diff' && <DiffEditor />}
      </div>
    </div>
  );
}
