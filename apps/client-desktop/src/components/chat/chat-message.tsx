import { useState } from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { AlertTriangle, ChevronRight, Brain } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@nexus-core/client-shared';
import { ToolCallBlock } from './tool-call-block.js';

interface ChatMessageProps {
  message: ChatMessageType;
}

function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!thinking && !isStreaming) return null;

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left mb-2 group"
    >
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors">
        <ChevronRight
          size={12}
          className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
        <Brain size={12} className={isStreaming ? 'animate-pulse text-[var(--accent-blue)]' : ''} />
        <span className="font-medium">
          {isStreaming ? 'Thinking...' : 'Thinking'}
        </span>
      </div>
      {expanded && thinking && (
        <div className="mt-2 pl-5 text-xs text-[var(--text-muted)] italic leading-relaxed whitespace-pre-wrap border-l-2 border-[var(--border-color)] max-h-[300px] overflow-y-auto">
          {thinking}
        </div>
      )}
    </button>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 ml-0.5 bg-[var(--text-secondary)] animate-pulse rounded-sm" />
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.role === 'system' && message.metadata?.error;

  if (isError) {
    return (
      <div className="flex items-start gap-2 px-4 py-1">
        <AlertTriangle size={14} className="text-[var(--accent-red)] shrink-0 mt-0.5" />
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-[var(--accent-red)]/10 text-[var(--accent-red)] border border-[var(--accent-red)]/30">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'system') {
    return (
      <div className="px-4 py-1 text-center">
        <span className="text-xs text-[var(--text-muted)] italic">{message.content}</span>
      </div>
    );
  }

  const showThinking = !isUser && (message.thinking || (message.isStreaming && !message.content));
  const showCursor = message.isStreaming && message.role === 'assistant';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} px-4 py-1`}>
      <div className="text-[10px] text-[var(--text-muted)] mb-0.5 px-1">
        {isUser ? 'You' : 'Assistant'}
      </div>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-[var(--accent-blue)] text-white'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
        }`}
      >
        {/* Thinking block */}
        {showThinking && (
          <ThinkingBlock
            thinking={message.thinking ?? ''}
            isStreaming={message.isStreaming}
          />
        )}

        {/* Main content */}
        {message.content ? (
          <Markdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre: ({ children }) => (
                <pre className="my-1 p-2 rounded bg-[var(--bg-primary)] overflow-x-auto text-xs">{children}</pre>
              ),
              code: ({ children, className }) =>
                className ? (
                  <code className={className}>{children}</code>
                ) : (
                  <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--accent-orange)] text-xs">{children}</code>
                ),
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
            }}
          >
            {message.content}
          </Markdown>
        ) : null}
        {showCursor && <StreamingCursor />}
      </div>
      {message.toolCalls?.map((tc) => (
        <div key={tc.id} className="max-w-[85%] mt-1">
          <ToolCallBlock toolCall={tc} />
        </div>
      ))}
    </div>
  );
}
