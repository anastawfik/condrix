import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  User,
  Bot,
  AlertTriangle,
  ChevronRight,
  Brain,
  Wrench,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import type {
  ChatMessage as ChatMessageType,
  ContentBlock as ContentBlockType,
} from '@condrix/client-shared';
import { ToolCallBlock } from './tool-call-block.js';

interface ChatMessageProps {
  message: ChatMessageType;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1">
      <Brain size={16} className="animate-pulse text-primary" />
      <span className="text-sm font-medium text-muted-foreground">Thinking...</span>
      <span className="flex gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </span>
    </div>
  );
}

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!thinking.trim()) return null;

  const lines = thinking.trimEnd().split('\n');
  const preview = lines.slice(-2).join('\n');

  return (
    <button onClick={() => setExpanded(!expanded)} className="w-full text-left mb-2 group">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-muted-foreground transition-colors">
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
        <Brain size={14} />
        <span className="font-medium">Thinking</span>
      </div>
      {expanded ? (
        <div className="mt-2 pl-5 text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap border-l-2 border-border max-h-[300px] overflow-y-auto">
          {thinking}
        </div>
      ) : (
        <div className="mt-1 pl-5 text-xs text-muted-foreground/60 italic leading-relaxed whitespace-pre-wrap border-l-2 border-border/50 line-clamp-2 overflow-hidden">
          {preview}
        </div>
      )}
    </button>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre: ({ children }) => (
          <pre className="my-2 p-3 rounded-lg bg-background overflow-x-auto text-xs border border-border">
            {children}
          </pre>
        ),
        code: ({ children, className }) =>
          className ? (
            <code className={className}>{children}</code>
          ) : (
            <code className="px-1.5 py-0.5 rounded-md bg-background text-chart-3 text-xs">
              {children}
            </code>
          ),
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside pl-4 mb-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside pl-4 mb-1.5">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-border">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
        th: ({ children }) => (
          <th className="px-3 py-1.5 text-left font-medium border border-border">{children}</th>
        ),
        td: ({ children }) => <td className="px-3 py-1.5 border border-border">{children}</td>,
      }}
    >
      {content}
    </Markdown>
  );
}

function ToolUseBlock({ block }: { block: ContentBlockType }) {
  const [expanded, setExpanded] = useState(false);
  const inputStr = block.input ? JSON.stringify(block.input, null, 2) : '';
  // Show a short summary of the input (first key=value)
  const inputSummary = block.input
    ? Object.entries(block.input)
        .slice(0, 1)
        .map(([k, v]) => {
          const val = typeof v === 'string' ? v : JSON.stringify(v);
          // Truncate long values (e.g., file paths)
          const short = val.length > 60 ? '...' + val.slice(-50) : val;
          return `${k}: ${short}`;
        })
        .join(', ')
    : '';

  return (
    <button onClick={() => setExpanded(!expanded)} className="w-full text-left my-1.5 group">
      <div className="flex items-center gap-1.5 text-xs cursor-pointer transition-colors">
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 text-muted-foreground ${expanded ? 'rotate-90' : ''}`}
        />
        <Wrench size={14} className="text-blue-500" />
        <span className="font-medium text-blue-500">{block.toolName ?? 'Tool'}</span>
        {inputSummary && <span className="text-muted-foreground truncate">{inputSummary}</span>}
      </div>
      {expanded && inputStr && (
        <pre className="mt-1.5 ml-5 p-2 text-xs bg-background rounded border border-border overflow-x-auto max-h-[200px] overflow-y-auto text-muted-foreground">
          {inputStr}
        </pre>
      )}
    </button>
  );
}

function ToolResultBlock({ block }: { block: ContentBlockType }) {
  const [expanded, setExpanded] = useState(false);
  const contentStr = block.content || '';
  const lineCount = contentStr.split('\n').length;
  const preview = contentStr.split('\n').slice(0, 3).join('\n');

  return (
    <button onClick={() => setExpanded(!expanded)} className="w-full text-left my-1 group">
      <div className="flex items-center gap-1.5 text-xs cursor-pointer transition-colors">
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 text-muted-foreground ${expanded ? 'rotate-90' : ''}`}
        />
        <CheckCircle2 size={14} className="text-green-500" />
        <span className="font-medium text-green-600">Result</span>
        <span className="text-muted-foreground">
          {lineCount > 1 ? `${lineCount} lines` : preview.slice(0, 60)}
        </span>
      </div>
      {expanded && contentStr && (
        <pre className="mt-1.5 ml-5 p-2 text-xs bg-background rounded border border-border overflow-x-auto max-h-[300px] overflow-y-auto text-muted-foreground whitespace-pre-wrap">
          {contentStr}
        </pre>
      )}
    </button>
  );
}

function ContentBlockRenderer({ blocks }: { blocks: ContentBlockType[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'thinking':
            return <ThinkingBlock key={i} thinking={block.content} />;
          case 'toolUse':
            return <ToolUseBlock key={i} block={block} />;
          case 'toolResult':
            return <ToolResultBlock key={i} block={block} />;
          case 'text':
          default:
            return <MarkdownContent key={i} content={block.content} />;
        }
      })}
    </>
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
          isUser ? 'bg-primary' : 'bg-accent border border-border'
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

          {/* Ordered content blocks (interleaved thinking/text) when available */}
          {message.contentBlocks && message.contentBlocks.length > 0 ? (
            <>
              <ContentBlockRenderer blocks={message.contentBlocks} />
            </>
          ) : (
            <>
              {/* Legacy fallback: thinking on top, then content */}
              {hasThinkingText && <ThinkingBlock thinking={message.thinking!} />}
              {message.content && <MarkdownContent content={message.content} />}
            </>
          )}
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
