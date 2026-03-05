import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Check, X, Clock } from 'lucide-react';
import type { ToolCall } from '@nexus-core/client-shared';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const StatusIcon = {
    pending: Clock,
    approved: Check,
    rejected: X,
    completed: Check,
  }[toolCall.status];

  const statusColor = {
    pending: 'text-[var(--accent-yellow)]',
    approved: 'text-[var(--accent-green)]',
    rejected: 'text-[var(--accent-red)]',
    completed: 'text-[var(--accent-green)]',
  }[toolCall.status];

  return (
    <div className="my-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2 py-1 hover:bg-[var(--bg-hover)]"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={12} className="text-[var(--accent-blue)]" />
        <span className="font-mono">{toolCall.name}</span>
        <StatusIcon size={12} className={statusColor} />
        <span className={`${statusColor} capitalize`}>{toolCall.status}</span>
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-[var(--border-color)]">
          <div className="font-mono text-[var(--text-muted)] whitespace-pre-wrap break-all">
            {JSON.stringify(toolCall.args, null, 2)}
          </div>
          {toolCall.result && (
            <div className="mt-2 pt-2 border-t border-[var(--border-color)] text-[var(--text-secondary)]">
              {toolCall.result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
