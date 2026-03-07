import { useState } from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { User, Bot, AlertTriangle, ChevronRight, Brain } from 'lucide-react';
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
          {isStreaming && !thinking ? 'Thinking...' : isStreaming ? 'Thinking...' : 'Thinking'}
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
      <div className="flex gap-2.5 px-4">
        <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 bg-[var(--accent-red)]/20 border border-[var(--accent-red)]/40">
          <AlertTriangle size={14} className="text-[var(--accent-red)]" />
        </div>
        <div className="flex flex-col items-start max-w-[80%]">
          <div className="text-[10px] text-[var(--accent-red)] mb-1 px-1 font-medium">Error</div>
          <div className="px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl rounded-bl-sm bg-[var(--accent-red)]/10 text-[var(--accent-red)] border border-[var(--accent-red)]/30">
            {message.content}
          </div>
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
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} px-4`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? 'bg-[var(--accent-blue)]'
            : 'bg-[var(--bg-active)] border border-[var(--border-color)]'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-[var(--accent-blue)]" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div className="text-[10px] text-[var(--text-muted)] mb-1 px-1 font-medium">
          {isUser ? 'You' : 'Assistant'}
        </div>
        <div
          className={`px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-[var(--accent-blue)] text-white rounded-2xl rounded-br-sm'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-2xl rounded-bl-sm border border-[var(--border-color)]'
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
                  <pre className="my-2 p-3 rounded-lg bg-[var(--bg-primary)] overflow-x-auto text-xs border border-[var(--border-color)]">{children}</pre>
                ),
                code: ({ children, className }) =>
                  className ? (
                    <code className={className}>{children}</code>
                  ) : (
                    <code className="px-1.5 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--accent-orange)] text-xs">{children}</code>
                  ),
                p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5">{children}</ol>,
                li: ({ children }) => <li className="mb-0.5">{children}</li>,
              }}
            >
              {message.content}
            </Markdown>
          ) : showCursor ? null : null}
          {showCursor && <StreamingCursor />}
        </div>
        {message.toolCalls?.map((tc) => (
          <div key={tc.id} className="w-full mt-1.5">
            <ToolCallBlock toolCall={tc} />
          </div>
        ))}
      </div>
    </div>
  );
}
