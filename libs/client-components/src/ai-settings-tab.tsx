import { useState, useEffect, useCallback } from 'react';
import {
  maestroStore, multiCoreStore, coreRegistryStore,
} from '@condrix/client-shared';
import type { MaestroConnectionState } from '@condrix/client-shared';
import { cn } from './lib/utils.js';
import { Button } from './button.js';

const MASK_CHAR = '\u2022';

export interface AiSettingsTabProps {
  onSignIn?: (coreId: string, coreName: string) => void;
}

/**
 * Authentication Tab — API Key + OAuth (Claude Plan) sections.
 * Replaces old inline AuthConfigSection flow with per-core sign-in buttons.
 */
export function AiSettingsTab({ onSignIn }: AiSettingsTabProps) {
  const [maestroState, setMaestroState] = useState<MaestroConnectionState>(
    () => maestroStore.getState().state,
  );

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => setMaestroState(s.state));
    return unsub;
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Authentication</h2>
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
          Configure how Cores authenticate with the Claude API.
        </p>
      </div>

      {/* API Key Section */}
      <ApiKeySection maestroConnected={maestroState === 'connected'} />

      {/* OAuth (Claude Plan) Section */}
      <OAuthCoresSection maestroConnected={maestroState === 'connected'} onSignIn={onSignIn} />
    </div>
  );
}

/* ─── API Key Section ────────────────────────────────────────────────────── */

function ApiKeySection({ maestroConnected }: { maestroConnected: boolean }) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load existing key (masked)
  useEffect(() => {
    loadApiKey();
  }, [maestroConnected]);

  const loadApiKey = async () => {
    if (maestroConnected) {
      try {
        const config = await maestroStore.getState().getAiConfig();
        if (config.apiKey && typeof config.apiKey === 'string') setApiKey(config.apiKey as string);
      } catch { /* ignore */ }
    } else {
      const connections = multiCoreStore.getState().connections;
      const firstCoreId = connections.keys().next().value;
      if (!firstCoreId) return;
      try {
        const result = await multiCoreStore.getState().requestOnCore<{ key: string; value: unknown }>(
          firstCoreId, 'core', 'config.get', { key: 'model.apiKey' },
        );
        if (result.value && typeof result.value === 'string') {
          setApiKey(result.value as string);
        }
      } catch { /* ignore */ }
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim() || apiKey.startsWith(MASK_CHAR)) return;
    setSaving(true);
    setStatus(null);
    try {
      if (maestroConnected) {
        await maestroStore.getState().setAiConfig({ method: 'apikey', apiKey });
      } else {
        // Push to ALL connected Cores
        const connections = multiCoreStore.getState().connections;
        for (const [coreId] of connections) {
          try {
            await multiCoreStore.getState().requestOnCore(
              coreId, 'core', 'config.set', { key: 'model.apiKey', value: apiKey },
            );
          } catch { /* Core may be offline */ }
        }
      }
      setStatus({ type: 'success', message: 'API key saved' });
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-4 border-b border-[var(--border-color)]">
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-1">API Key</h3>
      <p className="text-[10px] text-[var(--text-muted)] mb-3">
        {maestroConnected
          ? 'Managed by Maestro. Key is pushed to all connected Cores.'
          : 'Saved locally and pushed to all connected Cores.'}
      </p>

      <div className="flex items-center gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setStatus(null); }}
          placeholder="sk-ant-..."
          className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)] font-mono"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !apiKey.trim() || apiKey.startsWith(MASK_CHAR)}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {status && (
        <p className={cn('text-[11px] mt-1.5', status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]')}>
          {status.message}
        </p>
      )}
    </div>
  );
}

/* ─── OAuth (Claude Plan) Section ────────────────────────────────────────── */

interface CoreAuthInfo {
  coreId: string;
  name: string;
  connected: boolean;
  authStatus: 'authenticated' | 'expired' | 'not-configured' | 'loading';
}

function OAuthCoresSection({ maestroConnected, onSignIn }: { maestroConnected: boolean; onSignIn?: (coreId: string, coreName: string) => void }) {
  const [cores, setCores] = useState<CoreAuthInfo[]>([]);

  const fetchCoreList = useCallback(() => {
    if (maestroConnected) {
      const maestroCores = maestroStore.getState().maestroCores;
      const initial: CoreAuthInfo[] = maestroCores.map((mc) => ({
        coreId: mc.id,
        name: mc.displayName,
        connected: mc.status === 'online',
        authStatus: mc.status === 'online' ? 'loading' : 'not-configured',
      }));
      setCores(initial);

      // Fetch auth status for each online core
      for (const mc of maestroCores) {
        if (mc.status !== 'online') continue;
        multiCoreStore.getState().requestOnCore<{ authenticated: boolean; method: string; expiresAt?: string }>(
          mc.id, 'core', 'auth.status', {},
        ).then((result) => {
          setCores((prev) => prev.map((c) =>
            c.coreId === mc.id
              ? { ...c, authStatus: resolveAuthStatus(result) }
              : c,
          ));
        }).catch(() => {
          setCores((prev) => prev.map((c) =>
            c.coreId === mc.id ? { ...c, authStatus: 'not-configured' } : c,
          ));
        });
      }
    } else {
      const connections = multiCoreStore.getState().connections;
      const registry = coreRegistryStore.getState().cores;
      const initial: CoreAuthInfo[] = registry.map((entry) => {
        const conn = connections.get(entry.id);
        const isConnected = conn?.connState === 'connected';
        return {
          coreId: entry.id,
          name: entry.name,
          connected: isConnected,
          authStatus: isConnected ? 'loading' : 'not-configured',
        };
      });
      setCores(initial);

      // Fetch auth status for each connected core
      for (const entry of registry) {
        const conn = connections.get(entry.id);
        if (conn?.connState !== 'connected') continue;
        multiCoreStore.getState().requestOnCore<{ authenticated: boolean; method: string; expiresAt?: string }>(
          entry.id, 'core', 'auth.status', {},
        ).then((result) => {
          setCores((prev) => prev.map((c) =>
            c.coreId === entry.id
              ? { ...c, authStatus: resolveAuthStatus(result) }
              : c,
          ));
        }).catch(() => {
          setCores((prev) => prev.map((c) =>
            c.coreId === entry.id ? { ...c, authStatus: 'not-configured' } : c,
          ));
        });
      }
    }
  }, [maestroConnected]);

  useEffect(() => {
    fetchCoreList();

    // Re-fetch when connections change
    const unsub1 = multiCoreStore.subscribe(() => fetchCoreList());
    const unsub2 = maestroConnected
      ? maestroStore.subscribe(() => fetchCoreList())
      : coreRegistryStore.subscribe(() => fetchCoreList());
    return () => { unsub1(); unsub2(); };
  }, [fetchCoreList]);

  return (
    <div className="px-6 py-4">
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-1">OAuth (Claude Plan)</h3>
      <p className="text-[10px] text-[var(--text-muted)] mb-3">
        Sign in with your Claude account on each Core.
      </p>

      {cores.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">
          No Cores registered. Add a Core in the Cores tab first.
        </p>
      ) : (
        <div className="space-y-1.5">
          {cores.map((core) => (
            <div
              key={core.coreId}
              className="flex items-center justify-between p-2.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    core.connected ? 'bg-[var(--accent-green)]' : 'bg-[var(--text-muted)]',
                  )}
                />
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {core.name}
                </span>
                <AuthBadge status={core.authStatus} />
              </div>

              <div className="shrink-0 ml-2">
                {core.connected && onSignIn && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onSignIn(core.coreId, core.name)}
                  >
                    Sign In
                  </Button>
                )}
                {!core.connected && (
                  <span className="text-[10px] text-[var(--text-muted)]">Offline</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function resolveAuthStatus(result: { authenticated: boolean; method: string; expiresAt?: string }): CoreAuthInfo['authStatus'] {
  if (!result.authenticated) return 'not-configured';

  // Check for expiry
  if (result.expiresAt) {
    const expiresAtMs = Number(result.expiresAt);
    if (!isNaN(expiresAtMs) && expiresAtMs < Date.now()) {
      return 'expired';
    }
  }
  return 'authenticated';
}

function AuthBadge({ status }: { status: CoreAuthInfo['authStatus'] }) {
  if (status === 'loading') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
        ...
      </span>
    );
  }
  if (status === 'authenticated') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent-green)]/10 text-[var(--accent-green)] font-medium">
        Authenticated
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent-yellow,#eab308)]/10 text-[var(--accent-yellow,#eab308)] font-medium">
        Expired
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
      Not configured
    </span>
  );
}
