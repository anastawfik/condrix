import { useState, useEffect, useCallback } from 'react';
import { Collapsible } from 'radix-ui';
import { ChevronRight, Plus } from 'lucide-react';
import {
  coreRegistryStore, multiCoreStore, workspaceStore,
  useSettings,
} from '@nexus-core/client-shared';
import type { CoreEntry, CoreConnection } from '@nexus-core/client-shared';
import { cn } from './lib/utils.js';
import { Button } from './button.js';
import { Input } from './input.js';

/* ─── Types ──────────────────────────────────────────────────────────────── */

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
];

const MASK_CHAR = '\u2022';

type AuthMethod = 'apikey' | 'oauth';
type TunnelMode = 'quick' | 'named';

interface OAuthStatus {
  authenticated: boolean;
  method: 'oauth' | 'apikey' | 'none';
  expiresAt?: string;
}

interface TunnelStatus {
  running: boolean;
  url: string | null;
  mode: TunnelMode;
  cloudflaredInstalled: boolean;
  error: string | null;
}

/* ─── Main Tab ───────────────────────────────────────────────────────────── */

export function CoreSettingsTab() {
  const [cores, setCores] = useState<CoreEntry[]>(() => coreRegistryStore.getState().cores);
  const [connections, setConnections] = useState<Map<string, CoreConnection>>(
    () => multiCoreStore.getState().connections,
  );
  const [expandedCore, setExpandedCore] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = coreRegistryStore.subscribe((s) => setCores([...s.cores]));
    const unsub2 = multiCoreStore.subscribe((s) => setConnections(new Map(s.connections)));
    return () => { unsub1(); unsub2(); };
  }, []);

  // When a core is expanded, set it as active so useSettings routes to it
  useEffect(() => {
    if (expandedCore) {
      multiCoreStore.getState().setActiveCoreId(expandedCore);
    }
  }, [expandedCore]);

  // Auto-expand first core
  useEffect(() => {
    if (cores.length > 0 && !expandedCore) {
      setExpandedCore(cores[0].id);
    }
  }, [cores, expandedCore]);

  const handleRemoveCore = (id: string) => {
    multiCoreStore.getState().disconnectCore(id);
    coreRegistryStore.getState().removeCore(id);
    if (expandedCore === id) {
      setExpandedCore(null);
    }
  };

  const handleConnect = (entry: CoreEntry) => {
    multiCoreStore.getState().connectCore(entry);
  };

  const handleDisconnect = (id: string) => {
    multiCoreStore.getState().disconnectCore(id);
  };

  if (cores.length === 0) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          No Cores registered. Add one from the sidebar.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cores</h2>
      </div>
      <div className="space-y-1 px-2 pb-4">
        {cores.map((entry) => {
          const conn = connections.get(entry.id);
          const isConnected = conn?.connState === 'connected';
          const isExpanded = expandedCore === entry.id;

          return (
            <Collapsible.Root
              key={entry.id}
              open={isExpanded}
              onOpenChange={(open) => setExpandedCore(open ? entry.id : null)}
            >
              {/* Core header */}
              <div className={cn(
                'rounded-t border transition-colors',
                isExpanded
                  ? 'bg-[var(--bg-primary)] border-[var(--border-color)]'
                  : 'bg-[var(--bg-primary)] border-transparent hover:bg-[var(--bg-hover)]',
              )}>
                <div className="flex items-center justify-between px-3 py-2">
                  <Collapsible.Trigger className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <ChevronRight
                      size={14}
                      className={cn(
                        'shrink-0 text-[var(--text-muted)] transition-transform duration-150',
                        isExpanded && 'rotate-90',
                      )}
                    />
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        isConnected ? 'bg-[var(--accent-green)]' : 'bg-[var(--text-muted)]',
                      )}
                    />
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {entry.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                      {(() => { try { return new URL(entry.url).host; } catch { return entry.url; } })()}
                    </span>
                  </Collapsible.Trigger>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(entry.id)}
                        className="px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(entry)}
                        className="px-1.5 py-0.5 rounded text-[10px] text-[var(--accent-blue)] hover:bg-[var(--bg-hover)]"
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
              </div>

              {/* Collapsible content */}
              <Collapsible.Content className="rounded-b border border-t-0 border-[var(--border-color)] bg-[var(--bg-secondary)]">
                {isConnected ? (
                  <CoreConfigSections coreId={entry.id} entry={entry} />
                ) : (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-[var(--text-muted)]">
                      Connect to this Core to configure its settings.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => handleConnect(entry)}
                    >
                      Connect
                    </Button>
                  </div>
                )}
              </Collapsible.Content>
            </Collapsible.Root>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Per-Core Config Sections ───────────────────────────────────────────── */

function CoreConfigSections({ coreId, entry }: { coreId: string; entry: CoreEntry }) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['connection']));

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="divide-y divide-[var(--border-color)]">
      <CollapsibleSection
        id="connection"
        title="Connection"
        open={openSections.has('connection')}
        onToggle={() => toggleSection('connection')}
      >
        <ConnectionSection entry={entry} />
      </CollapsibleSection>

      <CollapsibleSection
        id="auth"
        title="Claude Authentication"
        open={openSections.has('auth')}
        onToggle={() => toggleSection('auth')}
      >
        <AuthSection coreId={coreId} />
      </CollapsibleSection>

      <CollapsibleSection
        id="tunnel"
        title="Tunnel"
        open={openSections.has('tunnel')}
        onToggle={() => toggleSection('tunnel')}
      >
        <TunnelSection coreId={coreId} />
      </CollapsibleSection>
    </div>
  );
}

/* ─── Generic Collapsible Section ────────────────────────────────────────── */

function CollapsibleSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible.Root open={open} onOpenChange={onToggle}>
      <Collapsible.Trigger className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors">
        <ChevronRight
          size={12}
          className={cn(
            'shrink-0 text-[var(--text-muted)] transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          {title}
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="px-4 pb-4">
          {children}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/* ─── Connection Section ─────────────────────────────────────────────────── */

function ConnectionSection({ entry }: { entry: CoreEntry }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)]">URL</span>
        <code className="text-[var(--text-primary)] font-mono bg-[var(--bg-primary)] px-1.5 py-0.5 rounded">
          {entry.url}
        </code>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)]">Token</span>
        <span className="text-[var(--text-muted)]">
          {entry.token ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'None (dev mode)'}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)]">Auto-connect</span>
        <span className={entry.autoConnect ? 'text-[var(--accent-green)]' : 'text-[var(--text-muted)]'}>
          {entry.autoConnect ? 'Yes' : 'No'}
        </span>
      </div>
    </div>
  );
}

/* ─── Auth Section ───────────────────────────────────────────────────────── */

function AuthSection({ coreId }: { coreId: string }) {
  const { settings, loading, setSetting, reload } = useSettings('model.');

  const [authMethod, setAuthMethod] = useState<AuthMethod>('apikey');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-5');
  const [maxTokens, setMaxTokens] = useState('8192');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null);
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchOAuthStatus();
  }, [coreId]);

  useEffect(() => {
    if (loading) return;
    const savedKey = settings['model.apiKey'] as string | undefined;
    if (savedKey) setApiKey(savedKey);
    const savedModel = settings['model.id'] as string | undefined;
    if (savedModel) setModel(savedModel);
    const savedTokens = settings['model.maxTokens'] as number | undefined;
    if (savedTokens) setMaxTokens(String(savedTokens));
    const savedPrompt = settings['model.systemPrompt'] as string | undefined;
    if (savedPrompt !== undefined) setSystemPrompt(savedPrompt);
  }, [settings, loading]);

  useEffect(() => {
    if (loading) return;
    const saved = settings['auth.method'] as string | undefined;
    if (saved === 'oauth' || saved === 'apikey') {
      setAuthMethod(saved);
    }
  }, [settings, loading]);

  const isMaskedValue = useCallback((value: string) => {
    return value.startsWith(MASK_CHAR);
  }, []);

  const fetchOAuthStatus = async () => {
    try {
      const result = await multiCoreStore.getState().requestOnCore<OAuthStatus>(
        coreId, 'core', 'config.oauthStatus', {},
      );
      setOAuthStatus(result);
    } catch {
      // Non-critical
    }
  };

  const handleBrowserLogin = async () => {
    setOAuthLoading(true);
    setStatus(null);
    try {
      const result = await multiCoreStore.getState().requestOnCore<{ url: string }>(
        coreId, 'core', 'oauth.login', {},
      );
      window.open(result.url, '_blank', 'noopener');
      setStatus({ type: 'success', message: 'Browser opened \u2014 complete sign-in there.' });

      const conn = multiCoreStore.getState().getConnection(coreId);
      if (conn) {
        const unsub = conn.store.getState().subscribe('core:oauthComplete', (event) => {
          const payload = event.payload as { success: boolean; message: string };
          setStatus({ type: payload.success ? 'success' : 'error', message: payload.message });
          setOAuthLoading(false);
          if (payload.success) {
            setAuthMethod('oauth');
            fetchOAuthStatus();
            reload('model.');
          }
          unsub();
        });
        setTimeout(() => { setOAuthLoading(false); unsub(); }, 5.5 * 60 * 1000);
      }
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
      setOAuthLoading(false);
    }
  };

  const handleImportOAuth = async () => {
    setOAuthLoading(true);
    setStatus(null);
    try {
      const result = await multiCoreStore.getState().requestOnCore<{ success: boolean; message: string }>(
        coreId, 'core', 'config.importOAuth', {},
      );
      setStatus({ type: result.success ? 'success' : 'error', message: result.message });
      if (result.success) {
        setAuthMethod('oauth');
        await fetchOAuthStatus();
        await reload('model.');
      }
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setOAuthLoading(false);
    }
  };

  const handleRefreshOAuth = async () => {
    setOAuthLoading(true);
    setStatus(null);
    try {
      const result = await multiCoreStore.getState().requestOnCore<{ success: boolean; expiresAt?: string }>(
        coreId, 'core', 'config.refreshOAuth', {},
      );
      if (result.success) {
        setStatus({ type: 'success', message: 'Token refreshed' });
        await fetchOAuthStatus();
      } else {
        setStatus({ type: 'error', message: 'Token refresh failed' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setOAuthLoading(false);
    }
  };

  const handleAuthMethodChange = async (method: AuthMethod) => {
    setAuthMethod(method);
    setStatus(null);
    try {
      await setSetting('auth.method', method);
    } catch { /* saved on next save */ }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await setSetting('auth.method', authMethod);
      if (authMethod === 'apikey' && !isMaskedValue(apiKey) && apiKey.trim()) {
        await setSetting('model.apiKey', apiKey.trim());
      }
      await setSetting('model.id', model);
      await setSetting('model.maxTokens', parseInt(maxTokens, 10) || 8192);
      await setSetting('model.systemPrompt', systemPrompt);
      setStatus({ type: 'success', message: 'Saved' });
      await reload('model.');
      await fetchOAuthStatus();
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-[var(--text-muted)] py-2">Loading...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Auth method toggle */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Method</label>
        <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
          <button
            onClick={() => handleAuthMethodChange('apikey')}
            className={cn(
              'flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors',
              authMethod === 'apikey'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            )}
          >
            API Key
          </button>
          <button
            onClick={() => handleAuthMethodChange('oauth')}
            className={cn(
              'flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors',
              authMethod === 'oauth'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            )}
          >
            Claude Plan (OAuth)
          </button>
        </div>
      </div>

      {/* API Key input */}
      {authMethod === 'apikey' && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[var(--text-secondary)]">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
      )}

      {/* OAuth section */}
      {authMethod === 'oauth' && (
        <div className="space-y-2">
          <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-secondary)]">Status</span>
              <span className={cn(
                'text-[11px] font-medium',
                oauthStatus?.authenticated && oauthStatus?.method === 'oauth'
                  ? 'text-[var(--accent-green)]'
                  : 'text-[var(--accent-red)]',
              )}>
                {oauthStatus?.authenticated && oauthStatus?.method === 'oauth'
                  ? 'Authenticated'
                  : 'Not authenticated'}
              </span>
            </div>
            {oauthStatus?.expiresAt && (
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-[var(--text-muted)]">Expires</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {new Date(oauthStatus.expiresAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleBrowserLogin}
            disabled={oauthLoading}
            className="w-full px-3 py-2 rounded bg-[var(--accent-blue)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {oauthLoading ? 'Waiting for sign-in...' : 'Sign in with Claude'}
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={handleImportOAuth}
              disabled={oauthLoading}
              className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] hover:opacity-90 disabled:opacity-50"
            >
              Import from Claude Code
            </button>
            <button
              onClick={handleRefreshOAuth}
              disabled={oauthLoading || !(oauthStatus?.authenticated && oauthStatus?.method === 'oauth')}
              className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] hover:opacity-90 disabled:opacity-50"
            >
              Refresh Token
            </button>
          </div>
        </div>
      )}

      {/* Model settings */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Max Output Tokens</label>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          min={1}
          max={128000}
          className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={3}
          placeholder="Optional system prompt..."
          className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs resize-y focus:outline-none focus:border-[var(--accent-blue)]"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {status && (
          <span className={cn(
            'text-[11px]',
            status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]',
          )}>
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Tunnel Section ─────────────────────────────────────────────────────── */

function TunnelSection({ coreId }: { coreId: string }) {
  const { settings, loading, setSetting } = useSettings('tunnel.');

  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null);
  const [mode, setMode] = useState<TunnelMode>('quick');
  const [token, setToken] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [installLoading, setInstallLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const requestOnCore = useCallback(async <T,>(action: string, payload: unknown = {}): Promise<T> => {
    return multiCoreStore.getState().requestOnCore<T>(coreId, 'core', action, payload);
  }, [coreId]);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await requestOnCore<TunnelStatus>('tunnel.status');
      setTunnelStatus(result);
    } catch { /* ignore */ }
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
  }, [coreId]);

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
    try { await setSetting('tunnel.autoStart', enabled); } catch { /* ignore */ }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <p className="text-xs text-[var(--text-muted)] py-2">Loading...</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[var(--text-muted)]">
        Expose this Core to the internet via Cloudflare Tunnel.
      </p>

      {/* cloudflared status */}
      <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-secondary)]">cloudflared</span>
          <span className={cn(
            'text-[11px] font-medium',
            tunnelStatus?.cloudflaredInstalled ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]',
          )}>
            {tunnelStatus?.cloudflaredInstalled ? 'Installed' : 'Not found'}
          </span>
        </div>
        {!tunnelStatus?.cloudflaredInstalled && (
          <div className="mt-2">
            <button
              onClick={handleInstall}
              disabled={installLoading}
              className="px-2 py-1 rounded bg-[var(--accent-blue)] text-white text-[10px] hover:opacity-90 disabled:opacity-50"
            >
              {installLoading ? 'Installing...' : 'Install cloudflared'}
            </button>
          </div>
        )}
      </div>

      {/* Tunnel mode */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Mode</label>
        <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
          <button
            onClick={() => setMode('quick')}
            className={cn(
              'flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors',
              mode === 'quick'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            )}
          >
            Quick
          </button>
          <button
            onClick={() => setMode('named')}
            className={cn(
              'flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors',
              mode === 'named'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            )}
          >
            Named
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">
          {mode === 'quick'
            ? 'Temporary URL, no account needed.'
            : 'Persistent URL, requires Cloudflare account.'}
        </p>
      </div>

      {/* Named tunnel token */}
      {mode === 'named' && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Tunnel Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJ..."
            className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
      )}

      {/* Auto-start */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => handleAutoStartChange(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-[var(--border-color)] accent-[var(--accent-blue)]"
        />
        <span className="text-[11px] text-[var(--text-secondary)]">Auto-start on Core startup</span>
      </label>

      {/* Active tunnel URL */}
      {tunnelStatus?.running && (
        <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--accent-green)]/30 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
            <span className="text-[11px] font-medium text-[var(--accent-green)]">Tunnel Active</span>
          </div>
          {tunnelStatus.url && (
            <div className="flex items-center gap-1.5">
              <code className="flex-1 text-[10px] text-[var(--text-primary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded font-mono truncate">
                {tunnelStatus.url}
              </code>
              <button
                onClick={() => handleCopy(tunnelStatus.url!)}
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
          <p className="text-[10px] text-[var(--text-muted)]">
            Clients need an auth token: <code className="text-[var(--accent-orange)]">nexus-core --generate-token</code>
          </p>
        </div>
      )}

      {/* Start/Stop */}
      <div className="flex items-center gap-2">
        {!tunnelStatus?.running ? (
          <Button
            size="sm"
            onClick={handleStart}
            disabled={actionLoading || !tunnelStatus?.cloudflaredInstalled || (mode === 'named' && !token)}
          >
            {actionLoading ? 'Starting...' : 'Start Tunnel'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={handleStop}
            disabled={actionLoading}
          >
            {actionLoading ? 'Stopping...' : 'Stop Tunnel'}
          </Button>
        )}
        {status && (
          <span className={cn(
            'text-[11px]',
            status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]',
          )}>
            {status.message}
          </span>
        )}
      </div>

      {tunnelStatus?.error && (
        <div className="p-1.5 rounded bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30">
          <p className="text-[10px] text-[var(--accent-red)]">{tunnelStatus.error}</p>
        </div>
      )}
    </div>
  );
}
