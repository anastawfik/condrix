import { Plus, X } from 'lucide-react';
import type { TerminalSession } from '@nexus-core/client-shared';

interface TerminalTabBarProps {
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
}

export function TerminalTabBar({ terminals, activeTerminalId, onSelect, onCreate, onClose }: TerminalTabBarProps) {
  return (
    <div className="flex items-center bg-[var(--bg-secondary)] border-b border-[var(--border-color)] shrink-0">
      <span className="px-2 py-1 text-[11px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">
        Terminal
      </span>

      <div className="flex items-center overflow-x-auto">
        {terminals.map((term, i) => (
          <button
            key={term.id}
            onClick={() => onSelect(term.id)}
            className={`flex items-center gap-1 px-2 py-1 text-xs border-r border-[var(--border-color)] group ${
              activeTerminalId === term.id
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <span>{i + 1}: {term.title}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onClose(term.id); }}
              className="p-0.5 rounded hover:bg-[var(--bg-active)] opacity-0 group-hover:opacity-100"
            >
              <X size={10} />
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={onCreate}
        className="p-1 mx-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
        title="New Terminal"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
