import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import type { ChatMessage as ChatMessageType } from '@nexus-core/client-shared';
import { ToolCallBlock } from './tool-call-block.js';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

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
      </div>
      {message.toolCalls?.map((tc) => (
        <div key={tc.id} className="max-w-[85%] mt-1">
          <ToolCallBlock toolCall={tc} />
        </div>
      ))}
    </div>
  );
}
