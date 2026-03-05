import { useState } from 'react';
import { useStore } from 'zustand';
import { Plus, Trash2, Plug, PlugZap } from 'lucide-react';
import { connectionStore, coreRegistryStore, type CoreEntry } from '@nexus-core/client-shared';

export function ConnectionDialog() {
  const cores = useStore(coreRegistryStore, (s) => s.cores);
  const connectionState = useStore(connectionStore, (s) => s.state);
  const connectionError = useStore(connectionStore, (s) => s.error);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('ws://localhost:9100');
  const [token, setToken] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) return;
    coreRegistryStore.getState().addCore({ name: name.trim(), url: url.trim(), token: token.trim() || undefined });
    setName('');
    setUrl('ws://localhost:9100');
    setToken('');
    setShowAdd(false);
  };

  const handleConnect = (core: CoreEntry) => {
    connectionStore.getState().connect({
      url: core.url,
      token: core.token ?? '',
      autoReconnect: true,
    });
    coreRegistryStore.getState().updateCore(core.id, { lastConnected: new Date().toISOString() });
  };

  const handleRemove = (id: string) => {
    coreRegistryStore.getState().removeCore(id);
  };

  const isConnecting = connectionState === 'connecting' || connectionState === 'reconnecting';

  return (
    <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
      <div className="w-[420px] bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] shadow-2xl">
        <div className="p-6 border-b border-[var(--border-color)]">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Connect to Core</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Select a saved Core or add a new one</p>
        </div>

        {connectionError && (
          <div className="mx-4 mt-3 p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-[var(--accent-red)]">
            {connectionError}
          </div>
        )}

        <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
          {cores.length === 0 && !showAdd && (
            <p className="text-xs text-[var(--text-muted)] text-center py-4">No saved Cores. Add one to get started.</p>
          )}

          {cores.map((core) => (
            <div key={core.id} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--bg-hover)] group">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{core.name}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{core.url}</div>
              </div>
              <button
                onClick={() => handleConnect(core)}
                disabled={isConnecting}
                className="p-1.5 rounded hover:bg-[var(--bg-active)] text-[var(--accent-blue)] disabled:opacity-50"
                title="Connect"
              >
                {isConnecting ? <PlugZap size={16} /> : <Plug size={16} />}
              </button>
              <button
                onClick={() => handleRemove(core.id)}
                className="p-1.5 rounded hover:bg-[var(--bg-active)] text-[var(--accent-red)] opacity-0 group-hover:opacity-100"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {showAdd && (
            <div className="p-3 rounded bg-[var(--bg-tertiary)] space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (e.g., My Server)"
                className="w-full px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                autoFocus
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="URL (e.g., ws://localhost:9100)"
                className="w-full px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token (optional for dev mode)"
                type="password"
                className="w-full px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">Cancel</button>
                <button onClick={handleAdd} className="px-3 py-1 text-xs rounded bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]">Add</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border-color)]">
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)] w-full justify-center"
            >
              <Plus size={14} />
              Add Core
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
