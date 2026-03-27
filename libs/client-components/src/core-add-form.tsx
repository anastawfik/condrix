import { useState } from 'react';
import { coreRegistryStore, multiCoreStore, maestroStore } from '@condrix/client-shared';
import { cn } from './lib/utils.js';
import { Button } from './button.js';
import { Input } from './input.js';

type TabId = 'local' | 'remote' | 'tunnel';

export interface CoreAddFormProps {
  mode: 'direct' | 'maestro';
  onDone?: () => void;
}

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function deriveCoreId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `core-${Date.now()}`
  );
}

export function CoreAddForm({ mode, onDone }: CoreAddFormProps) {
  const [tab, setTab] = useState<TabId>('local');
  const [localPort, setLocalPort] = useState('9100');
  const [remoteHost, setRemoteHost] = useState('');
  const [remotePort, setRemotePort] = useState('9100');
  const [remoteToken, setRemoteToken] = useState('');
  const [remoteName, setRemoteName] = useState('');
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [tunnelToken, setTunnelToken] = useState('');
  const [tunnelName, setTunnelName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // After Maestro registration, show the generated access token
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* ─── Direct mode handlers ───────────────────────────────────────────── */

  const connectDirect = (displayName: string, url: string, token?: string) => {
    const entry = coreRegistryStore.getState().addCore({
      name: displayName,
      url,
      token: token || undefined,
      autoConnect: true,
    });
    multiCoreStore.getState().connectCore(entry);
    onDone?.();
  };

  /* ─── Maestro mode handler ───────────────────────────────────────────── */

  const registerMaestro = async (displayName: string, url: string) => {
    const coreId = deriveCoreId(displayName);
    const accessToken = generateToken();
    await maestroStore.getState().addCore(coreId, displayName, accessToken);
    setRegisteredToken(accessToken);
  };

  /* ─── Tab submit handlers ────────────────────────────────────────────── */

  const handleLocal = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `ws://localhost:${localPort}`;
      const displayName = `Local (${localPort})`;
      if (mode === 'maestro') {
        await registerMaestro(displayName, url);
      } else {
        connectDirect(displayName, url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRemote = async () => {
    if (!remoteHost) return;
    setLoading(true);
    setError('');
    try {
      const url = `ws://${remoteHost}:${remotePort}`;
      const displayName = remoteName || `${remoteHost}:${remotePort}`;
      if (mode === 'maestro') {
        await registerMaestro(displayName, url);
      } else {
        connectDirect(displayName, url, remoteToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTunnel = async () => {
    if (!tunnelUrl) return;
    if (mode === 'direct' && !tunnelToken) return;
    setLoading(true);
    setError('');
    try {
      let wsUrl = tunnelUrl.trim().replace(/\/+$/, '');
      if (wsUrl.startsWith('https://')) wsUrl = 'wss://' + wsUrl.slice('https://'.length);
      else if (wsUrl.startsWith('http://')) wsUrl = 'ws://' + wsUrl.slice('http://'.length);
      else if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) wsUrl = 'wss://' + wsUrl;

      let displayName = tunnelName;
      if (!displayName) {
        try {
          displayName = new URL(wsUrl.replace('wss://', 'https://')).hostname;
        } catch {
          displayName = wsUrl;
        }
      }

      if (mode === 'maestro') {
        await registerMaestro(displayName, wsUrl);
      } else {
        connectDirect(displayName, wsUrl, tunnelToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Post-registration view (Maestro only) ──────────────────────────── */

  if (registeredToken) {
    return (
      <div className="p-3 rounded border border-[var(--accent-green)]/30 bg-[var(--bg-primary)] space-y-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
          <span className="text-xs font-medium text-[var(--accent-green)]">Core Registered</span>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)]">
          Configure your Core to connect to Maestro using this access token:
        </p>
        <div className="flex items-center gap-1.5">
          <code className="flex-1 text-[10px] text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1.5 rounded font-mono break-all select-all">
            {registeredToken}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(registeredToken);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="shrink-0 px-2 py-1 rounded text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onDone?.()}>
          Done
        </Button>
      </div>
    );
  }

  /* ─── Shared form ────────────────────────────────────────────────────── */

  const tabs: { id: TabId; label: string }[] = [
    { id: 'local', label: 'Local' },
    { id: 'remote', label: 'Remote' },
    { id: 'tunnel', label: 'Tunnel' },
  ];

  const actionLabel = mode === 'maestro' ? 'Register' : 'Connect';
  const loadingLabel = mode === 'maestro' ? 'Registering...' : 'Connecting...';

  return (
    <div className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] space-y-3">
      {/* Tab bar */}
      <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 px-2 py-1 text-[11px] font-medium transition-colors',
              tab === t.id
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'local' && (
        <div className="space-y-2">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Port
            </label>
            <Input
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value)}
              placeholder="9100"
              inputSize="sm"
            />
          </div>
          {error && <p className="text-[11px] text-[var(--accent-red)]">{error}</p>}
          <Button size="sm" onClick={handleLocal} disabled={loading} className="w-full">
            {loading ? loadingLabel : actionLabel}
          </Button>
        </div>
      )}

      {tab === 'remote' && (
        <div className="space-y-2">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Host
            </label>
            <Input
              value={remoteHost}
              onChange={(e) => setRemoteHost(e.target.value)}
              placeholder="192.168.1.50"
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Port
            </label>
            <Input
              value={remotePort}
              onChange={(e) => setRemotePort(e.target.value)}
              placeholder="9100"
              inputSize="sm"
            />
          </div>
          {mode === 'direct' && (
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Token
              </label>
              <Input
                value={remoteToken}
                onChange={(e) => setRemoteToken(e.target.value)}
                placeholder="Optional in dev"
                inputSize="sm"
                type="password"
              />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Display Name
            </label>
            <Input
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value)}
              placeholder="Work Machine"
              inputSize="sm"
            />
          </div>
          {error && <p className="text-[11px] text-[var(--accent-red)]">{error}</p>}
          <Button
            size="sm"
            onClick={handleRemote}
            disabled={loading || !remoteHost}
            className="w-full"
          >
            {loading ? loadingLabel : actionLabel}
          </Button>
        </div>
      )}

      {tab === 'tunnel' && (
        <div className="space-y-2">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Tunnel URL
            </label>
            <Input
              value={tunnelUrl}
              onChange={(e) => setTunnelUrl(e.target.value)}
              placeholder="https://abc-xyz.trycloudflare.com"
              inputSize="sm"
            />
          </div>
          {mode === 'direct' && (
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Auth Token
              </label>
              <Input
                value={tunnelToken}
                onChange={(e) => setTunnelToken(e.target.value)}
                placeholder="Required"
                inputSize="sm"
                type="password"
              />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Display Name
            </label>
            <Input
              value={tunnelName}
              onChange={(e) => setTunnelName(e.target.value)}
              placeholder="Remote Server"
              inputSize="sm"
            />
          </div>
          {error && <p className="text-[11px] text-[var(--accent-red)]">{error}</p>}
          <Button
            size="sm"
            onClick={handleTunnel}
            disabled={loading || !tunnelUrl || (mode === 'direct' && !tunnelToken)}
            className="w-full"
          >
            {loading ? loadingLabel : mode === 'direct' ? 'Connect via Tunnel' : actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
