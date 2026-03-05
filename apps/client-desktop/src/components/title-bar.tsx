import { useStore } from 'zustand';
import { connectionStore, workspaceStore } from '@nexus-core/client-shared';

interface TitleBarProps {
  onSettingsOpen?: () => void;
}

export function TitleBar({ onSettingsOpen }: TitleBarProps) {
  const connectionState = useStore(connectionStore, (s) => s.state);
  const coreInfo = useStore(connectionStore, (s) => s.coreInfo);
  const workspace = useStore(workspaceStore, (s) => s.currentWorkspace);

  const statusColor = connectionState === 'connected'
    ? 'bg-green-500'
    : connectionState === 'connecting' || connectionState === 'reconnecting'
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <div className="flex items-center h-9 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none shrink-0">
      <span className="font-semibold text-[var(--accent-blue)] mr-3">NexusCore</span>

      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs">
        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
        <span>{coreInfo?.displayName ?? 'Disconnected'}</span>
      </div>

      {workspace && (
        <>
          <span className="mx-2 text-[var(--text-muted)]">|</span>
          <span className="text-xs text-[var(--text-secondary)]">
            ws: {workspace.name}
          </span>
          <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-[var(--bg-active)] text-[var(--accent-green)] uppercase">
            {workspace.state}
          </span>
        </>
      )}

      <div className="flex-1" />

      <button
        onClick={onSettingsOpen}
        className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        aria-label="Open settings"
      >
        &#x2699;
      </button>
    </div>
  );
}
