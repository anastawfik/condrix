import { useState } from 'react';
import { Collapsible } from 'radix-ui';
import { ChevronRight, Terminal } from 'lucide-react';
import { cn } from './lib/utils.js';
import { Button } from './button.js';

export interface CoreCardProps {
  name: string;
  status: 'online' | 'offline' | 'connected' | 'disconnected';
  details: { label: string; value: string }[];
  expanded: boolean;
  onToggle: () => void;
  onRename?: (name: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onRemove?: () => void;
  onTerminal?: () => void;
  authStatus?: { authenticated: boolean; method: string };
  children?: React.ReactNode;
}

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-[var(--accent-green)]',
  connected: 'bg-[var(--accent-green)]',
  offline: 'bg-[var(--text-muted)]',
  disconnected: 'bg-[var(--text-muted)]',
};

const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  connected: 'Connected',
  offline: 'Offline',
  disconnected: 'Disconnected',
};

export function CoreCard({
  name,
  status,
  details,
  expanded,
  onToggle,
  onRename,
  onConnect,
  onDisconnect,
  onRemove,
  onTerminal,
  authStatus,
  children,
}: CoreCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);

  const isConnected = status === 'connected' || status === 'online';

  const handleRenameSubmit = () => {
    if (renameValue.trim() && onRename) {
      onRename(renameValue.trim());
    }
    setRenaming(false);
  };

  return (
    <Collapsible.Root open={expanded} onOpenChange={onToggle}>
      <div
        className={cn(
          'rounded-t border transition-colors',
          expanded
            ? 'bg-[var(--bg-primary)] border-[var(--border-color)]'
            : 'bg-[var(--bg-primary)] border-transparent hover:bg-[var(--bg-hover)]',
        )}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <Collapsible.Trigger className="flex items-center gap-2 text-left flex-1 min-w-0">
            <ChevronRight
              size={14}
              className={cn(
                'shrink-0 text-[var(--text-muted)] transition-transform duration-150',
                expanded && 'rotate-90',
              )}
            />
            <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLOR[status])} />
            {renaming ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenaming(false);
                  e.stopPropagation();
                }}
                onBlur={handleRenameSubmit}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="px-1 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--accent-blue)] text-[var(--text-primary)] text-sm focus:outline-none min-w-0 flex-1"
              />
            ) : (
              <span
                className="text-sm font-medium text-[var(--text-primary)] truncate cursor-pointer"
                onDoubleClick={(e) => {
                  if (onRename) {
                    e.stopPropagation();
                    setRenaming(true);
                    setRenameValue(name);
                  }
                }}
                title={onRename ? 'Double-click to rename' : undefined}
              >
                {name}
              </span>
            )}
          </Collapsible.Trigger>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span
              className={cn(
                'text-[10px] mr-1',
                isConnected ? 'text-[var(--accent-green)]' : 'text-[var(--text-muted)]',
              )}
            >
              {STATUS_LABEL[status]}
            </span>
            {isConnected && onDisconnect && (
              <button
                onClick={onDisconnect}
                className="px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              >
                Disconnect
              </button>
            )}
            {!isConnected && onConnect && (
              <button
                onClick={onConnect}
                className="px-1.5 py-0.5 rounded text-[10px] text-[var(--accent-blue)] hover:bg-[var(--bg-hover)]"
              >
                Connect
              </button>
            )}
            {isConnected && onTerminal && (
              <button
                onClick={(e) => { e.stopPropagation(); onTerminal(); }}
                className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-hover)]"
                title="Open Core Terminal"
              >
                <Terminal size={12} />
              </button>
            )}
            {isConnected && authStatus && !authStatus.authenticated && (
              <span className="text-[10px] text-[var(--accent-red)]" title="Auth required">&#x26A0;</span>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-hover)]"
                title="Remove Core"
              >
                &#x2715;
              </button>
            )}
          </div>
        </div>
      </div>

      <Collapsible.Content className="rounded-b border border-t-0 border-[var(--border-color)] bg-[var(--bg-secondary)]">
        {details.length > 0 && (
          <div className="px-4 py-3 space-y-1.5">
            {details.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">{d.label}</span>
                <code className="text-[var(--text-primary)] font-mono bg-[var(--bg-primary)] px-1.5 py-0.5 rounded text-[10px] max-w-[60%] truncate">
                  {d.value}
                </code>
              </div>
            ))}
          </div>
        )}
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
