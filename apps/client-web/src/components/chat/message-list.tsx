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
    if (messages.length !== lastMessageCount.current || isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      lastMessageCount.current = messages.length;
    }
  }, [messages, isStreaming]);

  const lastMessage = messages[messages.length - 1];
  const streamingContent = lastMessage?.isStreaming ? (lastMessage.content?.length ?? 0) + (lastMessage.thinking?.length ?? 0) : 0;
  useEffect(() => {
    if (streamingContent > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto py-5" data-testid="message-list">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center">
            <MessageSquare size={32} className="text-[var(--text-muted)]" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-[var(--text-secondary)]">No messages yet</p>
            <p className="text-sm text-[var(--text-muted)] mt-1.5">Send a message to start a conversation</p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
