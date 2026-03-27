import { useStore } from 'zustand';
import { Settings } from 'lucide-react';
import { multiCoreStore, workspaceStore, maestroStore } from '@condrix/client-shared';
import { cn } from './lib/utils.js';
import { IconButton } from './icon-button.js';

export interface TitleBarProps {
  onSettingsOpen?: () => void;
  maestroConnected?: boolean;
}

export function TitleBar({ onSettingsOpen, maestroConnected }: TitleBarProps) {
  const connections = useStore(multiCoreStore, (s) => s.connections);
  const maestroCores = useStore(maestroStore, (s) => s.maestroCores);
  const currentWorkspace = useStore(workspaceStore, (s) => s.currentWorkspace);
  const currentProjectId = useStore(workspaceStore, (s) => s.currentProjectId);
  const projects = useStore(workspaceStore, (s) => s.projects);

  // In Maestro mode, count from maestroCores; in Direct mode, count from connections
  let connectedCount: number;
  let totalCount: number;
  if (maestroConnected) {
    totalCount = maestroCores.length;
    connectedCount = maestroCores.filter((c) => c.status === 'online').length;
  } else {
    totalCount = connections.size;
    connectedCount = Array.from(connections.values()).filter(
      (c) => c.connState === 'connected',
    ).length;
  }

  const statusColor =
    connectedCount > 0
      ? connectedCount === totalCount
        ? 'bg-green-500'
        : 'bg-yellow-500'
      : totalCount > 0
        ? 'bg-red-500'
        : 'bg-[var(--text-muted)]';

  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null;

  return (
    <div
      className="flex items-center h-9 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none shrink-0"
      data-testid="title-bar"
    >
      <span className="font-semibold text-[var(--accent-blue)] mr-3">Condrix</span>

      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs">
        {maestroConnected && (
          <>
            <span
              className="w-2 h-2 rounded-full bg-[var(--accent-blue)]"
              title="Maestro connected"
            />
            <span className="text-[var(--accent-blue)]">Maestro</span>
            <span className="text-[var(--text-muted)]">|</span>
          </>
        )}
        <span className={cn('w-2 h-2 rounded-full', statusColor)} />
        <span>
          {totalCount > 0
            ? `${connectedCount}/${totalCount} Core${totalCount > 1 ? 's' : ''}`
            : 'No Cores'}
        </span>
      </div>

      {currentWorkspace && currentProject && (
        <>
          <span className="mx-2 text-[var(--text-muted)]">|</span>
          <span className="text-xs text-[var(--text-primary)]">
            {currentProject.name} / {currentWorkspace.name}
          </span>
        </>
      )}

      <div className="flex-1" />

      <IconButton icon={<Settings size={14} />} tooltip="Settings" onClick={onSettingsOpen} />
    </div>
  );
}
