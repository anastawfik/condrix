import { Plus, X } from 'lucide-react';
import type { TerminalSession } from '@nexus-core/client-shared';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  Tooltip, TooltipProvider,
} from '@nexus-core/client-components';

interface TerminalTabBarProps {
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
}

export function TerminalTabBar({ terminals, activeTerminalId, onSelect, onCreate, onClose }: TerminalTabBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center h-9 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] shrink-0 select-none">
        <span className="px-3 text-xs uppercase tracking-wide font-semibold text-[var(--text-secondary)] whitespace-nowrap">
          Terminal
        </span>

        <div className="flex items-center gap-0.5 overflow-x-auto h-full px-1">
          {terminals.map((term) => {
            const isActive = activeTerminalId === term.id;
            return (
              <ContextMenu key={term.id}>
                <ContextMenuTrigger asChild>
                  <button
                    onClick={() => onSelect(term.id)}
                    className={[
                      'flex items-center gap-1.5 h-7 px-3 text-sm rounded whitespace-nowrap group transition-colors',
                      isActive
                        ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                    ].join(' ')}
                  >
                    <span>{term.title}</span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); onClose(term.id); }}
                      className={[
                        'inline-flex items-center justify-center w-5 h-5 rounded',
                        'hover:bg-[var(--bg-active)] transition-opacity',
                        isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100',
                      ].join(' ')}
                    >
                      <X size={14} />
                    </span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => onClose(term.id)}>Close</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>

        <div className="ml-auto flex items-center px-2">
          <Tooltip content="New Terminal">
            <button
              onClick={onCreate}
              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
              aria-label="New Terminal"
            >
              <Plus size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
