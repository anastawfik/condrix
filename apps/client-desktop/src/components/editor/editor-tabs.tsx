import { useStore } from 'zustand';
import { MessageSquare } from 'lucide-react';
import { workspaceStore, useFileContent } from '@nexus-core/client-shared';
import { useState } from 'react';
import { EditorTab } from './editor-tab.js';
import { CodeEditor } from './code-editor.js';
import { ChatPanel } from '../chat/chat-panel.js';

type ActiveView = 'chat' | 'editor';

export function EditorTabs() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useFileContent(workspaceId);
  const [activeView, setActiveView] = useState<ActiveView>('chat');

  const handleFileSelect = (path: string) => {
    setActiveFile(path);
    setActiveView('editor');
  };

  const handleChatSelect = () => {
    setActiveView('chat');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] overflow-x-auto shrink-0">
        {/* Persistent Chat tab */}
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

        {/* File tabs */}
        {openFiles.map((file) => (
          <EditorTab
            key={file.path}
            file={file}
            isActive={activeView === 'editor' && activeFilePath === file.path}
            onSelect={() => handleFileSelect(file.path)}
            onClose={() => closeFile(file.path)}
          />
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {activeView === 'chat' ? <ChatPanel /> : <CodeEditor />}
      </div>
    </div>
  );
}
