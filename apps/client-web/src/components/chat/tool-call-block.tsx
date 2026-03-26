import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Check, X, Loader2 } from 'lucide-react';
import type { ToolCall } from '@condrix/client-shared';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const StatusIcon = {
    pending: Loader2,
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

  const statusBg = {
    pending: 'bg-[color-mix(in_srgb,var(--accent-yellow)_12%,transparent)]',
    approved: 'bg-[color-mix(in_srgb,var(--accent-green)_12%,transparent)]',
    rejected: 'bg-[color-mix(in_srgb,var(--accent-red)_12%,transparent)]',
    completed: 'bg-[color-mix(in_srgb,var(--accent-green)_12%,transparent)]',
  }[toolCall.status];

  return (
    <div className="my-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs overflow-hidden transition-all duration-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="text-[var(--text-muted)] transition-transform duration-150" style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(0deg)' }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <Wrench size={12} className="text-[var(--accent-blue)]" />
        <span className="font-mono font-medium text-[var(--text-primary)]">{toolCall.name}</span>
        <span className="ml-auto" />
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${statusBg}`}>
          <StatusIcon size={10} className={`${statusColor} ${toolCall.status === 'pending' ? 'animate-spin' : ''}`} />
          <span className={`${statusColor} capitalize text-[10px]`}>{toolCall.status}</span>
        </span>
      </button>

      {expanded && (
        <div className="px-3 py-2.5 border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 font-medium">Arguments</p>
          <div className="font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-all bg-[var(--bg-secondary)] rounded-md p-2 border border-[var(--border-color)]">
            {JSON.stringify(toolCall.args, null, 2)}
          </div>
          {toolCall.result && (
            <div className="mt-2.5">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 font-medium">Result</p>
              <div className="text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-md p-2 border border-[var(--border-color)] whitespace-pre-wrap break-all">
                {toolCall.result}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
