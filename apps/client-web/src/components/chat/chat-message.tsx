import { useState } from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { User, Bot, AlertTriangle, ChevronRight, Brain } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@nexus-core/client-shared';
import { ToolCallBlock } from './tool-call-block.js';

interface ChatMessageProps {
  message: ChatMessageType;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
      <Brain size={14} className="animate-pulse text-primary" />
      <span className="font-medium">Thinking...</span>
    </div>
  );
}

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!thinking.trim()) return null;

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left mb-2 group"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-muted-foreground transition-colors">
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
        <Brain size={14} />
        <span className="font-medium">Thinking</span>
      </div>
      {expanded && (
        <div className="mt-2 pl-5 text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap border-l-2 border-border max-h-[300px] overflow-y-auto">
          {thinking}
        </div>
      )}
    </button>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 ml-0.5 bg-muted-foreground animate-pulse rounded-sm" />
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.role === 'system' && message.metadata?.error;

  if (isError) {
    return (
      <div className="flex gap-3 px-4">
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 bg-destructive/20 border border-destructive/40">
          <AlertTriangle size={16} className="text-destructive" />
        </div>
        <div className="flex flex-col items-start max-w-[80%]">
          <div className="text-xs text-destructive mb-1 px-1 font-medium">Error</div>
          <div className="px-4 py-3 text-sm leading-relaxed rounded-2xl rounded-bl-sm bg-destructive/10 text-destructive border border-destructive/30">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'system') {
    return (
      <div className="px-4 py-1 text-center">
        <span className="text-xs text-muted-foreground italic">{message.content}</span>
      </div>
    );
  }

  const isWaitingForContent = message.isStreaming && !message.content && !message.thinking;
  const hasThinkingText = !!(message.thinking && message.thinking.trim());
  const showCursor = message.isStreaming && message.role === 'assistant';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} px-4`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? 'bg-primary'
            : 'bg-accent border border-border'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-primary-foreground" />
        ) : (
          <Bot size={16} className="text-primary" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div className="text-xs text-muted-foreground mb-1 px-1 font-medium">
          {isUser ? 'You' : 'Assistant'}
        </div>
        <div
          className={`px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
              : 'bg-secondary text-foreground rounded-2xl rounded-bl-sm border border-border'
          }`}
        >
          {/* Thinking indicator (shown while waiting for content) */}
          {isWaitingForContent && <ThinkingIndicator />}
          {/* Thinking block (shown when actual thinking text exists) */}
          {hasThinkingText && <ThinkingBlock thinking={message.thinking!} />}

          {/* Main content */}
          {message.content ? (
            <Markdown
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre: ({ children }) => (
                  <pre className="my-2 p-3 rounded-lg bg-background overflow-x-auto text-xs border border-border">{children}</pre>
                ),
                code: ({ children, className }) =>
                  className ? (
                    <code className={className}>{children}</code>
                  ) : (
                    <code className="px-1.5 py-0.5 rounded-md bg-background text-chart-3 text-xs">{children}</code>
                  ),
                p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside pl-4 mb-1.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside pl-4 mb-1.5">{children}</ol>,
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
