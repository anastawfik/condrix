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
      className="w-full text-left mb-3 group"
    >
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors">
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
        <Brain size={14} className={isStreaming ? 'animate-pulse text-[var(--accent-blue)]' : ''} />
        <span className="font-medium">
          {isStreaming ? 'Thinking...' : 'Thinking'}
        </span>
      </div>
      {expanded && thinking && (
        <div className="mt-2 pl-6 text-sm text-[var(--text-muted)] italic leading-relaxed whitespace-pre-wrap border-l-2 border-[var(--border-color)] max-h-[300px] overflow-y-auto">
          {thinking}
        </div>
      )}
    </button>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-5 ml-0.5 bg-[var(--text-secondary)] animate-pulse rounded-sm" />
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.role === 'system' && message.metadata?.error;

  if (isError) {
    return (
      <div className="flex gap-3 px-5">
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 bg-[var(--accent-red)]/20 border border-[var(--accent-red)]/40">
          <AlertTriangle size={16} className="text-[var(--accent-red)]" />
        </div>
        <div className="flex flex-col items-start max-w-[80%]">
          <div className="text-xs text-[var(--accent-red)] mb-1 px-1 font-medium">Error</div>
          <div className="px-4 py-3 text-sm leading-relaxed rounded-2xl rounded-bl-sm bg-[var(--accent-red)]/10 text-[var(--accent-red)] border border-[var(--accent-red)]/30">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'system') {
    return (
      <div className="px-5 py-2 text-center">
        <span className="text-sm text-[var(--text-muted)] italic">{message.content}</span>
      </div>
    );
  }

  const showThinking = !isUser && (message.thinking || (message.isStreaming && !message.content));
  const showCursor = message.isStreaming && message.role === 'assistant';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} px-5`} data-testid={`chat-message-${message.role}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? 'bg-[var(--accent-blue)]'
            : 'bg-[var(--bg-active)] border border-[var(--border-color)]'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-[var(--accent-blue)]" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div className="text-xs text-[var(--text-muted)] mb-1 px-1 font-medium">
          {isUser ? 'You' : 'Assistant'}
        </div>
        <div
          className={`px-4 py-3 text-sm leading-relaxed ${
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
                h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0 text-[var(--text-primary)]">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0 text-[var(--text-primary)]">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-[var(--text-primary)]">{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0 text-[var(--text-secondary)]">{children}</h4>,
                strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-blue)] underline underline-offset-2 hover:brightness-125">{children}</a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-3 border-[var(--accent-blue)] pl-4 my-2 text-[var(--text-secondary)] italic">{children}</blockquote>
                ),
                hr: () => <hr className="my-3 border-[var(--border-color)]" />,
                pre: ({ children }) => (
                  <pre className="my-3 p-4 rounded-lg bg-[var(--bg-primary)] overflow-x-auto text-sm border border-[var(--border-color)]">{children}</pre>
                ),
                code: ({ children, className }) =>
                  className ? (
                    <code className={className}>{children}</code>
                  ) : (
                    <code className="px-1.5 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--accent-orange)] text-[13px]">{children}</code>
                  ),
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 [&_ul]:ml-4 [&_ul]:mt-1 [&_ul]:mb-0">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 [&_ol]:ml-4 [&_ol]:mt-1 [&_ol]:mb-0">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                table: ({ children }) => (
                  <div className="my-3 overflow-x-auto"><table className="w-full text-sm border-collapse border border-[var(--border-color)]">{children}</table></div>
                ),
                thead: ({ children }) => <thead className="bg-[var(--bg-primary)]">{children}</thead>,
                th: ({ children }) => <th className="px-3 py-2 text-left font-semibold border border-[var(--border-color)] text-[var(--text-primary)]">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 border border-[var(--border-color)]">{children}</td>,
              }}
            >
              {message.content}
            </Markdown>
          ) : showCursor ? null : null}
          {showCursor && <StreamingCursor />}
        </div>
        {message.toolCalls?.map((tc) => (
          <div key={tc.id} className="w-full mt-2">
            <ToolCallBlock toolCall={tc} />
          </div>
        ))}
      </div>
    </div>
  );
}
