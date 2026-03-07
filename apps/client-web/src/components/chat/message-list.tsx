import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@nexus-core/client-shared';
import { ChatMessage } from './chat-message.js';

interface MessageListProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageCount = useRef(messages.length);

  useEffect(() => {
    // Auto-scroll on new messages or streaming updates
    if (messages.length !== lastMessageCount.current || isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      lastMessageCount.current = messages.length;
    }
  }, [messages, isStreaming]);

  // Also scroll when streaming message content changes
  const lastMessage = messages[messages.length - 1];
  const streamingContent = lastMessage?.isStreaming ? (lastMessage.content?.length ?? 0) + (lastMessage.thinking?.length ?? 0) : 0;
  useEffect(() => {
    if (streamingContent > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-2 py-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center">
            <MessageSquare size={28} className="text-[var(--text-muted)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">No messages yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Send a message to start a conversation</p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
