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
    <div className="flex items-center h-[28px] bg-[var(--bg-secondary)] border-b border-[var(--border-color)] shrink-0 select-none">
      <span className="px-2 text-[11px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] whitespace-nowrap">
        Terminal
      </span>

      <div className="flex items-center overflow-x-auto h-full">
        {terminals.map((term) => {
          const isActive = activeTerminalId === term.id;
          return (
            <button
              key={term.id}
              onClick={() => onSelect(term.id)}
              className={[
                'flex items-center gap-1 h-full px-2 text-[11px] whitespace-nowrap group',
                'border-r border-[var(--border-color)] transition-colors duration-75',
                isActive
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-t border-t-[var(--border-active)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
              ].join(' ')}
            >
              <span className="leading-none">{term.title}</span>
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onClose(term.id); }}
                className={[
                  'inline-flex items-center justify-center w-4 h-4 rounded-sm ml-0.5',
                  'hover:bg-[var(--bg-active)] transition-opacity duration-75',
                  isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100',
                ].join(' ')}
              >
                <X size={10} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center pr-1">
        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors duration-75"
          title="New Terminal"
          aria-label="New Terminal"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
