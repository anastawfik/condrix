import { useStore } from 'zustand';
import { MessageSquare, GitCompareArrows, X } from 'lucide-react';
import { workspaceStore, useFileContent, gitStore } from '@nexus-core/client-shared';
import { useState, useEffect } from 'react';
import { EditorTab } from './editor-tab.js';
import { CodeEditor } from './code-editor.js';
import { ChatPanel } from '../chat/chat-panel.js';
import { DiffEditor } from './diff-editor.js';

export type ActiveView = 'chat' | 'editor' | 'diff';

/** localStorage key for persisted UI state */
const UI_STATE_KEY = 'nexus-ui-state';

export function EditorTabs() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useFileContent(workspaceId);
  const openDiffs = useStore(gitStore, (s) => s.openDiffs);
  const activeDiffPath = useStore(gitStore, (s) => s.activeDiffPath);

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

  const handleChatSelect = () => {
    setActiveView('chat');
  };

  const fileName = (path: string) => path.split('/').pop() ?? path;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] overflow-x-auto shrink-0">
        <button
          onClick={handleChatSelect}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-[var(--border-color)] ${
            activeView === 'chat'
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent-blue)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-t-2 border-t-transparent hover:bg-[var(--bg-hover)]'
          }`}
        >
          <MessageSquare size={12} />
          Chat
        </button>

        {openFiles.map((file) => (
          <EditorTab
            key={file.path}
            file={file}
            isActive={activeView === 'editor' && activeFilePath === file.path}
            onSelect={() => handleFileSelect(file.path)}
            onClose={() => closeFile(file.path)}
          />
        ))}

        {openDiffs.map((diff) => (
          <div
            key={`diff:${diff.path}`}
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
