import { useState, useEffect } from 'react';
import { coreRegistryStore, multiCoreStore, workspaceStore } from '@nexus-core/client-shared';
import type { CoreEntry, CoreConnection } from '@nexus-core/client-shared';
import { ModelSettings } from './model-settings.js';
import { NetworkSettings } from './network-settings.js';

export function CoreSettingsTab() {
  const [cores, setCores] = useState<CoreEntry[]>(() => coreRegistryStore.getState().cores);
  const [connections, setConnections] = useState<Map<string, CoreConnection>>(
    () => multiCoreStore.getState().connections,
  );

  const activeCoreId =
    workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
  const activeEntry = cores.find((c) => c.id === activeCoreId);

  useEffect(() => {
    const unsub1 = coreRegistryStore.subscribe((s) => setCores([...s.cores]));
    const unsub2 = multiCoreStore.subscribe((s) => setConnections(new Map(s.connections)));
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleRemoveCore = (id: string) => {
    multiCoreStore.getState().disconnectCore(id);
    coreRegistryStore.getState().removeCore(id);
  };

  const handleConnect = (entry: CoreEntry) => {
    multiCoreStore.getState().connectCore(entry);
  };

  const handleDisconnect = (id: string) => {
    multiCoreStore.getState().disconnectCore(id);
  };

  const handleSetActive = (id: string) => {
    multiCoreStore.getState().setActiveCoreId(id);
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Core list */}
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Cores</h2>

        {cores.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No Cores registered. Add one from the sidebar.
          </p>
        ) : (
          <div className="space-y-1.5">
            {cores.map((entry) => {
              const conn = connections.get(entry.id);
              const isConnected = conn?.connState === 'connected';
              const isActive = entry.id === activeCoreId;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-3 py-2 rounded text-sm border transition-colors ${
                    isActive
                      ? 'bg-[var(--bg-active)] border-[var(--accent-blue)]/30'
                      : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <button
                    onClick={() => handleSetActive(entry.id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isConnected ? 'bg-[var(--accent-green)]' : 'bg-[var(--text-muted)]'
                      }`}
                    />
                    <span className="text-[var(--text-primary)] truncate">{entry.name}</span>
                    <span className="text-xs text-[var(--text-muted)] shrink-0">
                      {new URL(entry.url).host}
                    </span>
                    {isActive && (
                      <span className="text-[10px] text-[var(--accent-blue)] shrink-0">active</span>
                    )}
                  </button>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(entry.id)}
                        className="px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                        title="Disconnect"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(entry)}
                        className="px-1.5 py-0.5 rounded text-[10px] text-[var(--accent-blue)] hover:bg-[var(--bg-hover)]"
                        title="Connect"
                      >
                        Connect
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveCore(entry.id)}
                      className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-hover)]"
                      title="Remove Core"
                    >
                      &#x2715;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active core config */}
      {activeCoreId && activeEntry ? (
        <>
          <div className="mx-6 mt-2 border-t border-[var(--border-color)]" />
          <div className="px-6 pt-3 pb-0">
            <p className="text-xs text-[var(--text-muted)]">
              Configuring:{' '}
              <span className="font-medium text-[var(--text-secondary)]">{activeEntry.name}</span>
              {' '}
              <span className="text-[var(--text-muted)]">({new URL(activeEntry.url).host})</span>
            </p>
          </div>

          {/* Auth & Model settings */}
          <ModelSettings />

          {/* Network / Tunnel settings */}
          <div className="mx-6 border-t border-[var(--border-color)]" />
          <NetworkSettings />
        </>
      ) : (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {cores.length > 0
              ? 'Connect to a Core to configure its settings.'
              : 'Add a Core from the sidebar to get started.'}
          </p>
        </div>
      )}
    </div>
  );
}
