import { useState, useEffect, useCallback } from 'react';
import { useSettings, multiCoreStore, workspaceStore } from '@condrix/client-shared';

type TunnelMode = 'quick' | 'named';

interface TunnelStatus {
  running: boolean;
  url: string | null;
  mode: TunnelMode;
  cloudflaredInstalled: boolean;
  error: string | null;
}

export function NetworkSettings() {
  const { settings, loading, setSetting, reload } = useSettings('tunnel.');

  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null);
  const [mode, setMode] = useState<TunnelMode>('quick');
  const [token, setToken] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [installLoading, setInstallLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const getActiveCoreId = () =>
    workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;

  const requestOnCore = useCallback(async <T,>(action: string, payload: unknown = {}): Promise<T> => {
    const coreId = getActiveCoreId();
    if (!coreId) throw new Error('No Core connected');
    return multiCoreStore.getState().requestOnCore<T>(coreId, 'core', action, payload);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await requestOnCore<TunnelStatus>('tunnel.status');
      setTunnelStatus(result);
    } catch {
      // Non-critical
    }
  }, [requestOnCore]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (loading) return;
    const savedMode = settings['tunnel.mode'] as TunnelMode | undefined;
    if (savedMode) setMode(savedMode);
    const savedToken = settings['tunnel.token'] as string | undefined;
    if (savedToken) setToken(savedToken);
    const savedAutoStart = settings['tunnel.autoStart'] as boolean | undefined;
    if (savedAutoStart !== undefined) setAutoStart(savedAutoStart);
  }, [settings, loading]);

  useEffect(() => {
    const coreId = getActiveCoreId();
    if (!coreId) return;
    const conn = multiCoreStore.getState().getConnection(coreId);
    if (!conn) return;

    const unsubs = [
      conn.store.getState().subscribe('core:tunnelStarted', (event) => {
        const payload = event.payload as { url?: string; mode?: string };
        setTunnelStatus((prev) => ({
          ...(prev ?? { cloudflaredInstalled: true, error: null }),
          running: true,
          url: payload.url ?? prev?.url ?? null,
          mode: (payload.mode as TunnelMode) ?? prev?.mode ?? 'quick',
        }));
        setActionLoading(false);
      }),
      conn.store.getState().subscribe('core:tunnelStopped', () => {
        setTunnelStatus((prev) => ({
          ...(prev ?? { cloudflaredInstalled: true, error: null, mode: 'quick' as TunnelMode }),
          running: false,
          url: null,
        }));
        setActionLoading(false);
      }),
      conn.store.getState().subscribe('core:tunnelError', (event) => {
        const payload = event.payload as { error: string };
        setStatus({ type: 'error', message: payload.error });
        setActionLoading(false);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    setStatus(null);
    try {
      await setSetting('tunnel.mode', mode);
      if (mode === 'named' && token) {
        await setSetting('tunnel.token', token);
      }

      const result = await requestOnCore<{ running: boolean; url?: string; mode: string }>('tunnel.start', {
        mode,
        token: mode === 'named' ? token : undefined,
      });

      if (result.url) {
        setTunnelStatus((prev) => ({
          ...(prev ?? { cloudflaredInstalled: true, error: null }),
          running: true,
          url: result.url ?? null,
          mode: result.mode as TunnelMode,
        }));
      }
      setStatus({ type: 'success', message: 'Tunnel started' });
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    setStatus(null);
    try {
      await requestOnCore('tunnel.stop');
      setStatus({ type: 'success', message: 'Tunnel stopped' });
      await fetchStatus();
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInstall = async () => {
    setInstallLoading(true);
    setStatus(null);
    try {
      const result = await requestOnCore<{ success: boolean; message: string }>('tunnel.install');
      setStatus({ type: result.success ? 'success' : 'error', message: result.message });
      if (result.success) await fetchStatus();
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setInstallLoading(false);
    }
  };

  const handleAutoStartChange = async (enabled: boolean) => {
    setAutoStart(enabled);
    try {
      await setSetting('tunnel.autoStart', enabled);
    } catch { /* will be saved on next setting change */ }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="p-6 text-[var(--text-secondary)]">Loading settings...</div>;
  }

  return (
    <div className="p-6 space-y-5 max-w-lg">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Network</h2>
      <p className="text-sm text-[var(--text-muted)]">
        Expose this Core to the internet via Cloudflare Tunnel.
        No port forwarding or firewall changes needed.
      </p>

      {/* cloudflared status */}
      <div className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">cloudflared</span>
          <span className={`text-sm font-medium ${
            tunnelStatus?.cloudflaredInstalled
              ? 'text-[var(--accent-green)]'
              : 'text-[var(--accent-red)]'
          }`}>
            {tunnelStatus?.cloudflaredInstalled ? 'Installed' : 'Not found'}
          </span>
        </div>
        {!tunnelStatus?.cloudflaredInstalled && (
          <div className="mt-2">
            <button
              onClick={handleInstall}
              disabled={installLoading}
              className="px-3 py-1.5 rounded bg-[var(--accent-blue)] text-white text-sm hover:opacity-90 disabled:opacity-50"
            >
              {installLoading ? 'Installing...' : 'Install cloudflared'}
            </button>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Downloads the official binary from Cloudflare's GitHub releases.
            </p>
          </div>
        )}
      </div>

      {/* Tunnel mode */}
      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">Tunnel Mode</label>
        <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
          <button
            onClick={() => setMode('quick')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'quick'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            Quick Tunnel
          </button>
          <button
            onClick={() => setMode('named')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'named'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            Named Tunnel
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {mode === 'quick'
            ? 'Creates a temporary URL. No Cloudflare account needed. URL changes on restart.'
            : 'Uses a persistent URL from your Cloudflare account. Requires a tunnel token.'}
        </p>
      </div>

      {/* Named tunnel token */}
      {mode === 'named' && (
        <div className="space-y-1.5">
          <label className="block text-sm text-[var(--text-secondary)]">Tunnel Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJ..."
            className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
          />
          <p className="text-xs text-[var(--text-muted)]">
            Get your token from Cloudflare Zero Trust &rarr; Networks &rarr; Tunnels &rarr; Create &rarr; Token.
          </p>
        </div>
      )}

      {/* Auto-start */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => handleAutoStartChange(e.target.checked)}
          className="w-4 h-4 rounded border-[var(--border-color)] accent-[var(--accent-blue)]"
        />
        <span className="text-sm text-[var(--text-secondary)]">Auto-start tunnel when Core starts</span>
      </label>

      {/* Tunnel status & URL */}
      {tunnelStatus?.running && (
        <div className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--accent-green)]/30 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-pulse" />
            <span className="text-sm font-medium text-[var(--accent-green)]">Tunnel Active</span>
          </div>
          {tunnelStatus.url && (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded font-mono truncate">
                {tunnelStatus.url}
              </code>
              <button
                onClick={() => handleCopy(tunnelStatus.url!)}
                className="shrink-0 px-2 py-1 rounded text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            Remote clients can connect using this URL.
            They will need an auth token — generate one with <code className="text-[var(--accent-orange)]">condrix --generate-token</code>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!tunnelStatus?.running ? (
          <button
            onClick={handleStart}
            disabled={actionLoading || !tunnelStatus?.cloudflaredInstalled || (mode === 'named' && !token)}
            className="px-4 py-2 rounded bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {actionLoading ? 'Starting...' : 'Start Tunnel'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={actionLoading}
            className="px-4 py-2 rounded bg-[var(--accent-red)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {actionLoading ? 'Stopping...' : 'Stop Tunnel'}
          </button>
        )}
        {status && (
          <span className={`text-sm ${status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            {status.message}
          </span>
        )}
      </div>

      {tunnelStatus?.error && (
        <div className="p-2 rounded bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30">
          <p className="text-xs text-[var(--accent-red)]">{tunnelStatus.error}</p>
        </div>
      )}
    </div>
  );
}
