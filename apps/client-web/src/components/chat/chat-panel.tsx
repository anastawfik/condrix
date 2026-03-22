import { useStore } from 'zustand';
import { workspaceStore, useWorkspace } from '@nexus-core/client-shared';
import { MessageList } from './message-list.js';
import { ChatInput } from './chat-input.js';
import { ChatHeader } from './chat-header.js';

export function ChatPanel() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const { messages, isStreaming, sendMessage } = useWorkspace(workspaceId);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]" data-testid="chat-panel">
      <ChatHeader />
      <MessageList messages={messages} isStreaming={isStreaming} />
      <ChatInput onSend={sendMessage} disabled={isStreaming || !workspaceId} />
    </div>
  );
}
