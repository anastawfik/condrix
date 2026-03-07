import { useStore } from 'zustand';
import { Settings } from 'lucide-react';
import { multiCoreStore, workspaceStore } from '@nexus-core/client-shared';
import { cn } from './lib/utils.js';
import { IconButton } from './icon-button.js';

export interface TitleBarProps {
  onSettingsOpen?: () => void;
}

export function TitleBar({ onSettingsOpen }: TitleBarProps) {
  const connections = useStore(multiCoreStore, (s) => s.connections);
  const currentWorkspace = useStore(workspaceStore, (s) => s.currentWorkspace);
  const currentProjectId = useStore(workspaceStore, (s) => s.currentProjectId);
  const projects = useStore(workspaceStore, (s) => s.projects);

  const connectedCount = Array.from(connections.values()).filter(
    (c) => c.store.getState().state === 'connected',
  ).length;
  const totalCount = connections.size;

  const statusColor = connectedCount > 0
    ? connectedCount === totalCount ? 'bg-green-500' : 'bg-yellow-500'
    : totalCount > 0 ? 'bg-red-500' : 'bg-[var(--text-muted)]';

  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null;

  return (
    <div className="flex items-center h-9 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none shrink-0">
      <span className="font-semibold text-[var(--accent-blue)] mr-3">NexusCore</span>

      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs">
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

      <IconButton
        icon={<Settings size={14} />}
        tooltip="Settings"
        onClick={onSettingsOpen}
      />
    </div>
  );
}
