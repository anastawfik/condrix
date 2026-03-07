import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '@nexus-core/client-shared';
import { ChatMessage } from './chat-message.js';

interface MessageListProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  const lastMessage = messages[messages.length - 1];
  const streamingContent = lastMessage?.isStreaming ? (lastMessage.content?.length ?? 0) + (lastMessage.thinking?.length ?? 0) : 0;
  useEffect(() => {
    if (streamingContent > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
          Send a message to start a conversation
        </div>
      )}
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
