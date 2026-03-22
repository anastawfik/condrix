import { Plus, X } from 'lucide-react';
import type { TerminalSession } from '@nexus-core/client-shared';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface TerminalTabBarProps {
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
}

export function TerminalTabBar({ terminals, activeTerminalId, onSelect, onCreate, onClose }: TerminalTabBarProps) {
  return (
    <div className="flex items-center h-9 bg-secondary border-b border-border shrink-0 select-none">
      <span className="px-2 text-sm uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap">
        Terminal
      </span>

      <div className="flex items-center overflow-x-auto h-full">
        {terminals.map((term) => {
          const isActive = activeTerminalId === term.id;
          return (
            <ContextMenu key={term.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => onSelect(term.id)}
                  className={[
                    'flex items-center gap-1.5 h-full px-3 text-sm whitespace-nowrap group',
                    'border-r border-border transition-colors duration-75',
                    isActive
                      ? 'bg-background text-foreground border-t border-t-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  <span className="leading-none">{term.title}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => { e.stopPropagation(); onClose(term.id); }}
                    className={[
                      'inline-flex items-center justify-center w-5 h-5 rounded-sm ml-0.5',
                      'hover:bg-muted transition-opacity duration-75',
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

      <div className="ml-auto flex items-center pr-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCreate}
              className="inline-flex items-center justify-center w-7 h-7 rounded-sm hover:bg-accent text-muted-foreground transition-colors duration-75"
              aria-label="New Terminal"
            >
              <Plus size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>New Terminal</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
