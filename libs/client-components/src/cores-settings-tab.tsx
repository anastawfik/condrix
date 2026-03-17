import { useState, useEffect, useCallback } from 'react';
import {
  maestroStore, multiCoreStore, coreRegistryStore, useSettings,
} from '@nexus-core/client-shared';
import type { MaestroConnectionState, MaestroCore, CoreEntry, CoreConnection } from '@nexus-core/client-shared';
import { cn } from './lib/utils.js';
import { Button } from './button.js';
import { CoreCard } from './core-card.js';
import { CoreAddForm } from './core-add-form.js';
import { CollapsibleSection } from './collapsible-section.js';

type ConnectMode = 'direct' | 'maestro';

/* ─── Main Component ────────────────────────────────────────────────────── */

export function CoresSettingsTab() {
  const [mode, setMode] = useState<ConnectMode>(() => {
    const maestro = maestroStore.getState();
    return maestro.state === 'connected' ? 'maestro' : 'direct';
  });
  const [maestroState, setMaestroState] = useState<MaestroConnectionState>(
    () => maestroStore.getState().state,
  );

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => {
      setMaestroState(s.state);
      if (s.state === 'connected') setMode('maestro');
    });
    return unsub;
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      {/* Mode toggle */}
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Cores</h2>
        <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
          <button
            onClick={() => setMode('direct')}
            className={cn(
              'flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors',
              mode === 'direct'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            )}
          >
            Direct
          </button>
          <button
            onClick={() => setMode('maestro')}
            className={cn(
              'flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors',
              mode === 'maestro'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            )}
          >
            Maestro
            {maestroState === 'connected' && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] inline-block" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-1">
          {mode === 'direct'
            ? 'Connect directly to individual Cores.'
            : 'Connect via Maestro for centralized management.'}
        </p>
      </div>

      {mode === 'direct' ? <DirectCoresPanel /> : <MaestroSection maestroState={maestroState} />}
    </div>
  );
}

/* ─── Direct Cores Panel ─────────────────────────────────────────────────── */

function DirectCoresPanel() {
  const [cores, setCores] = useState<CoreEntry[]>(() => coreRegistryStore.getState().cores);
  const [connections, setConnections] = useState<Map<string, CoreConnection>>(
    () => multiCoreStore.getState().connections,
  );
  const [expandedCore, setExpandedCore] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [openSections, setOpenSections] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    const unsub1 = coreRegistryStore.subscribe((s) => setCores([...s.cores]));
    const unsub2 = multiCoreStore.subscribe((s) => setConnections(new Map(s.connections)));
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (expandedCore) {
      multiCoreStore.getState().setActiveCoreId(expandedCore);
    }
  }, [expandedCore]);

  useEffect(() => {
    if (cores.length > 0 && !expandedCore) {
      setExpandedCore(cores[0].id);
    }
  }, [cores, expandedCore]);

  const handleRemoveCore = (id: string) => {
    multiCoreStore.getState().disconnectCore(id);
    coreRegistryStore.getState().removeCore(id);
    if (expandedCore === id) setExpandedCore(null);
  };

  const handleConnect = (entry: CoreEntry) => {
    multiCoreStore.getState().connectCore(entry);
  };

  const handleDisconnect = (id: string) => {
    multiCoreStore.getState().disconnectCore(id);
  };

  const toggleSection = (coreId: string, sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Map(prev);
      const sections = new Set(next.get(coreId) ?? ['connection']);
      if (sections.has(sectionId)) sections.delete(sectionId);
      else sections.add(sectionId);
      next.set(coreId, sections);
      return next;
    });
  };

  return (
    <div className="px-2 pb-4">
      {/* Core list */}
      <div className="space-y-1">
        {cores.map((entry) => {
          const conn = connections.get(entry.id);
          const isConnected = conn?.connState === 'connected';

          return (
            <CoreCard
              key={entry.id}
              name={entry.name}
              status={isConnected ? 'connected' : 'disconnected'}
              details={[]}
              expanded={expandedCore === entry.id}
              onToggle={() => setExpandedCore(expandedCore === entry.id ? null : entry.id)}
              onConnect={() => handleConnect(entry)}
              onDisconnect={() => handleDisconnect(entry.id)}
              onRemove={() => handleRemoveCore(entry.id)}
            >
              {isConnected ? (
                <div className="divide-y divide-[var(--border-color)]">
                  <CollapsibleSection
                    id="connection"
                    title="Connection"
                    open={(openSections.get(entry.id) ?? new Set(['connection'])).has('connection')}
                    onToggle={() => toggleSection(entry.id, 'connection')}
                  >
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
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection
                    id="tunnel"
                    title="Tunnel"
                    open={(openSections.get(entry.id) ?? new Set(['connection'])).has('tunnel')}
                    onToggle={() => toggleSection(entry.id, 'tunnel')}
                  >
                    <TunnelSection coreId={entry.id} />
                  </CollapsibleSection>
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-[var(--text-muted)]">
                    Connect to this Core to configure its settings.
                  </p>
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => handleConnect(entry)}>
                    Connect
                  </Button>
                </div>
              )}
            </CoreCard>
          );
        })}
      </div>

      {/* Add Core */}
      <div className="mt-3">
        <Button size="sm" variant="secondary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '+ Add Core'}
        </Button>
        {showAdd && (
          <div className="mt-2">
            <CoreAddForm mode="direct" onDone={() => setShowAdd(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tunnel Section (reused from core-settings-tab) ─────────────────────── */

function TunnelSection({ coreId }: { coreId: string }) {
  const { settings, loading, setSetting } = useSettings('tunnel.');

  const [tunnelStatus, setTunnelStatus] = useState<{
    running: boolean; url: string | null; mode: 'quick' | 'named'; cloudflaredInstalled: boolean; error: string | null;
  } | null>(null);
  const [mode, setMode] = useState<'quick' | 'named'>('quick');
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
      const result = await requestOnCore<typeof tunnelStatus>('tunnel.status');
      setTunnelStatus(result);
    } catch { /* ignore */ }
  }, [requestOnCore]);

  useEffect(() => { fetchStatus(); const i = setInterval(fetchStatus, 5000); return () => clearInterval(i); }, [fetchStatus]);

  useEffect(() => {
    if (loading) return;
    if (settings['tunnel.mode']) setMode(settings['tunnel.mode'] as 'quick' | 'named');
    if (settings['tunnel.token']) setToken(settings['tunnel.token'] as string);
    if (settings['tunnel.autoStart'] !== undefined) setAutoStart(settings['tunnel.autoStart'] as boolean);
  }, [settings, loading]);

  const handleStart = async () => {
    setActionLoading(true);
    setStatus(null);
    try {
      await setSetting('tunnel.mode', mode);
      if (mode === 'named' && token) await setSetting('tunnel.token', token);
      await requestOnCore('tunnel.start', { mode, token: mode === 'named' ? token : undefined });
      setStatus({ type: 'success', message: 'Tunnel started' });
      await fetchStatus();
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
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

  if (loading) return <p className="text-xs text-[var(--text-muted)] py-2">Loading...</p>;

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[var(--text-muted)]">Expose this Core via Cloudflare Tunnel.</p>

      <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-secondary)]">cloudflared</span>
          <span className={cn('text-[11px] font-medium', tunnelStatus?.cloudflaredInstalled ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]')}>
            {tunnelStatus?.cloudflaredInstalled ? 'Installed' : 'Not found'}
          </span>
        </div>
        {!tunnelStatus?.cloudflaredInstalled && (
          <button onClick={handleInstall} disabled={installLoading} className="mt-2 px-2 py-1 rounded bg-[var(--accent-blue)] text-white text-[10px] hover:opacity-90 disabled:opacity-50">
            {installLoading ? 'Installing...' : 'Install cloudflared'}
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Mode</label>
        <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
          {(['quick', 'named'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn('flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors', mode === m ? 'bg-[var(--accent-blue)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]')}>
              {m === 'quick' ? 'Quick' : 'Named'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'named' && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Tunnel Token</label>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJ..." className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]" />
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={autoStart} onChange={(e) => { setAutoStart(e.target.checked); setSetting('tunnel.autoStart', e.target.checked).catch(() => {}); }} className="w-3.5 h-3.5 rounded border-[var(--border-color)] accent-[var(--accent-blue)]" />
        <span className="text-[11px] text-[var(--text-secondary)]">Auto-start on Core startup</span>
      </label>

      {tunnelStatus?.running && tunnelStatus.url && (
        <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--accent-green)]/30 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
            <span className="text-[11px] font-medium text-[var(--accent-green)]">Tunnel Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 text-[10px] text-[var(--text-primary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded font-mono truncate">{tunnelStatus.url}</code>
            <button onClick={() => { navigator.clipboard.writeText(tunnelStatus.url!); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {!tunnelStatus?.running ? (
          <Button size="sm" onClick={handleStart} disabled={actionLoading || !tunnelStatus?.cloudflaredInstalled || (mode === 'named' && !token)}>
            {actionLoading ? 'Starting...' : 'Start Tunnel'}
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={handleStop} disabled={actionLoading}>
            {actionLoading ? 'Stopping...' : 'Stop Tunnel'}
          </Button>
        )}
        {status && <span className={cn('text-[11px]', status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]')}>{status.message}</span>}
      </div>
    </div>
  );
}

/* ─── Maestro Section ───────────────────────────────────────────────────── */

function MaestroSection({ maestroState }: { maestroState: MaestroConnectionState }) {
  return (
    <div>
      <MaestroConnectionPanel maestroState={maestroState} />
      {maestroState === 'connected' && <MaestroCoresPanel />}
    </div>
  );
}

/* ─── Maestro Connection Panel ──────────────────────────────────────────── */

function MaestroConnectionPanel({ maestroState }: { maestroState: MaestroConnectionState }) {
  const [url, setUrl] = useState(() => {
    try { return localStorage.getItem('nexus-maestro-url') ?? ''; } catch { return ''; }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState(() => maestroStore.getState().user);
  const [maestroUrl, setMaestroUrl] = useState(() => maestroStore.getState().url);

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => { setUser(s.user); setMaestroUrl(s.url); });
    return unsub;
  }, []);

  const handleLogin = async () => {
    if (!url.trim() || !username.trim() || !password.trim()) { setError('All fields are required'); return; }
    setLoading(true);
    setError(null);
    try {
      try { localStorage.setItem('nexus-maestro-url', url.trim()); } catch { /* ignore */ }
      await maestroStore.getState().login(url.trim(), username.trim(), password, showTotp ? totpCode.trim() : undefined);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'TOTP_REQUIRED') { setShowTotp(true); setError('Enter your TOTP code'); }
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleLogin(); };

  if (maestroState === 'connected') {
    return (
      <div className="px-6 py-4 space-y-3">
        <div className="p-3 rounded border border-[var(--accent-green)]/30 bg-[var(--bg-primary)] space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
            <span className="text-xs font-medium text-[var(--accent-green)]">Connected to Maestro</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-muted)]">URL</span>
              <code className="text-[var(--text-primary)] font-mono bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[10px]">{maestroUrl}</code>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-muted)]">User</span>
              <span className="text-[var(--text-primary)]">{user?.username}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-muted)]">Role</span>
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', user?.role === 'admin' ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]')}>{user?.role}</span>
            </div>
          </div>
        </div>
        <Button size="sm" variant="danger" onClick={() => maestroStore.getState().logout()}>Disconnect</Button>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 space-y-3" onKeyDown={handleKeyDown}>
      <p className="text-[11px] text-[var(--text-secondary)]">Sign in to Maestro for centralized management.</p>
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Maestro URL</label>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://localhost:9200" className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]" />
      </div>
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Username</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]" />
      </div>
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]" />
      </div>
      {showTotp && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[var(--text-secondary)]">TOTP Code</label>
          <input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="123456" maxLength={6} autoFocus className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)] font-mono tracking-wider" />
        </div>
      )}
      {error && <p className="text-[11px] text-[var(--accent-red)]">{error}</p>}
      <Button size="sm" onClick={handleLogin} disabled={loading} className="w-full">{loading ? 'Signing in...' : 'Sign In'}</Button>
    </div>
  );
}

/* ─── Maestro Cores Panel ───────────────────────────────────────────────── */

function MaestroCoresPanel() {
  const [cores, setCores] = useState<MaestroCore[]>(() => maestroStore.getState().maestroCores);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(() => maestroStore.getState().user);
  const [showAdd, setShowAdd] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [expandedCore, setExpandedCore] = useState<string | null>(null);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [tokenValue, setTokenValue] = useState('');

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => { setCores(s.maestroCores); setUser(s.user); });
    return unsub;
  }, []);

  const isAdmin = user?.role === 'admin';

  const handleRemove = async (id: string) => {
    try { await maestroStore.getState().removeCore(id); } catch (err) { setStatus({ type: 'error', message: (err as Error).message }); }
  };

  const handleRename = async (id: string, name: string) => {
    if (!name.trim()) return;
    try { await maestroStore.getState().renameCore(id, name.trim()); } catch (err) { setStatus({ type: 'error', message: (err as Error).message }); }
  };

  const handleUpdateToken = async (id: string) => {
    if (!tokenValue.trim()) { setEditingTokenId(null); return; }
    try {
      await maestroStore.getState().request('maestro', 'cores.updateToken', { id, accessToken: tokenValue.trim() });
      setStatus({ type: 'success', message: 'Token updated' });
      setEditingTokenId(null);
      setTokenValue('');
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    }
  };

  return (
    <div className="px-6 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--text-primary)]">Registered Cores</h3>
        <div className="flex items-center gap-1">
          <button onClick={async () => { setLoading(true); try { await maestroStore.getState().fetchCores(); } finally { setLoading(false); } }} disabled={loading} className="px-2 py-1 rounded text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? 'Cancel' : 'Register Core'}
            </Button>
          )}
        </div>
      </div>

      {status && <p className={cn('text-[11px]', status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]')}>{status.message}</p>}

      {showAdd && <CoreAddForm mode="maestro" onDone={() => setShowAdd(false)} />}

      {cores.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">No Cores registered.</p>
      ) : (
        <div className="space-y-1">
          {cores.map((core) => (
            <CoreCard
              key={core.id}
              name={core.displayName}
              status={core.status}
              details={[
                { label: 'Core ID', value: core.coreId },
                { label: 'Database ID', value: core.id },
                { label: 'Status', value: core.status },
              ]}
              expanded={expandedCore === core.id}
              onToggle={() => setExpandedCore(expandedCore === core.id ? null : core.id)}
              onRename={(name) => handleRename(core.id, name)}
              onRemove={isAdmin ? () => handleRemove(core.id) : undefined}
            >
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Access Token</span>
                  {editingTokenId === core.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="password"
                        value={tokenValue}
                        onChange={(e) => setTokenValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateToken(core.id);
                          if (e.key === 'Escape') { setEditingTokenId(null); setTokenValue(''); }
                        }}
                        autoFocus
                        placeholder="New token..."
                        className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--accent-blue)] text-[var(--text-primary)] text-[10px] font-mono focus:outline-none w-32"
                      />
                      <button
                        onClick={() => handleUpdateToken(core.id)}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent-blue)] text-white hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingTokenId(null); setTokenValue(''); }}
                        className="px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-muted)] text-[10px]">{'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}</span>
                      {isAdmin && (
                        <button
                          onClick={() => { setEditingTokenId(core.id); setTokenValue(''); }}
                          className="px-1.5 py-0.5 rounded text-[10px] text-[var(--accent-blue)] hover:bg-[var(--bg-hover)]"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CoreCard>
          ))}
        </div>
      )}
    </div>
  );
}
