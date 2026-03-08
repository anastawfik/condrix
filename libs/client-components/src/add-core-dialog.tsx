import { useState } from 'react';
import { Monitor, Globe, Cloud } from 'lucide-react';
import { coreRegistryStore, multiCoreStore } from '@nexus-core/client-shared';
import { Dialog } from './dialog.js';
import { Button } from './button.js';
import { Input } from './input.js';
import { Tabs, TabList, Tab, TabPanel } from './tabs.js';

export interface AddCoreDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddCoreDialog({ open, onClose }: AddCoreDialogProps) {
  // Local tab
  const [localPort, setLocalPort] = useState('9100');
  // Remote tab
  const [remoteHost, setRemoteHost] = useState('');
  const [remotePort, setRemotePort] = useState('9100');
  const [remoteToken, setRemoteToken] = useState('');
  const [remoteName, setRemoteName] = useState('');
  // Tunnel tab
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [tunnelToken, setTunnelToken] = useState('');
  const [tunnelName, setTunnelName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnectLocal = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `ws://localhost:${localPort}`;
      const entry = coreRegistryStore.getState().addCore({
        name: `Local (${localPort})`,
        url,
        autoConnect: true,
      });
      multiCoreStore.getState().connectCore(entry);
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectRemote = async () => {
    if (!remoteHost) return;
    setLoading(true);
    setError('');
    try {
      const url = `ws://${remoteHost}:${remotePort}`;
      const displayName = remoteName || `${remoteHost}:${remotePort}`;
      const entry = coreRegistryStore.getState().addCore({
        name: displayName,
        url,
        token: remoteToken || undefined,
        autoConnect: true,
      });
      multiCoreStore.getState().connectCore(entry);
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectTunnel = async () => {
    if (!tunnelUrl || !tunnelToken) return;
    setLoading(true);
    setError('');
    try {
      // Convert https:// to wss:// for WebSocket over Cloudflare tunnel
      let wsUrl = tunnelUrl.trim().replace(/\/+$/, '');
      if (wsUrl.startsWith('https://')) {
        wsUrl = 'wss://' + wsUrl.slice('https://'.length);
      } else if (wsUrl.startsWith('http://')) {
        wsUrl = 'ws://' + wsUrl.slice('http://'.length);
      } else if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
        wsUrl = 'wss://' + wsUrl;
      }

      // Derive display name from URL hostname
      let displayName = tunnelName;
      if (!displayName) {
        try {
          const parsed = new URL(wsUrl.replace('wss://', 'https://').replace('ws://', 'http://'));
          displayName = parsed.hostname;
        } catch {
          displayName = wsUrl;
        }
      }

      const entry = coreRegistryStore.getState().addCore({
        name: displayName,
        url: wsUrl,
        token: tunnelToken,
        autoConnect: true,
      });
      multiCoreStore.getState().connectCore(entry);
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLocalPort('9100');
    setRemoteHost('');
    setRemotePort('9100');
    setRemoteToken('');
    setRemoteName('');
    setTunnelUrl('');
    setTunnelToken('');
    setTunnelName('');
    setError('');
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add Core" className="w-[420px]">
      <Tabs defaultTab="local">
        <TabList className="px-4">
          <Tab id="local" icon={<Monitor size={12} />}>Local</Tab>
          <Tab id="remote" icon={<Globe size={12} />}>Remote</Tab>
          <Tab id="tunnel" icon={<Cloud size={12} />}>Tunnel</Tab>
        </TabList>

        <TabPanel id="local" className="p-4 space-y-3">
          <p className="text-[11px] text-[var(--text-secondary)]">
            Connect to a Core running on this machine.
          </p>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Port</label>
            <Input
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value)}
              placeholder="9100"
              inputSize="sm"
            />
          </div>
          {error && <p className="text-[11px] text-[var(--accent-red)]">{error}</p>}
          <Button size="sm" onClick={handleConnectLocal} disabled={loading} className="w-full">
            {loading ? 'Connecting...' : 'Connect'}
          </Button>
        </TabPanel>

        <TabPanel id="remote" className="p-4 space-y-3">
          <p className="text-[11px] text-[var(--text-secondary)]">
            Connect to a Core on your local network.
          </p>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Host</label>
            <Input
              value={remoteHost}
              onChange={(e) => setRemoteHost(e.target.value)}
              placeholder="192.168.1.50"
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Port</label>
            <Input
              value={remotePort}
              onChange={(e) => setRemotePort(e.target.value)}
              placeholder="9100"
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Token</label>
            <Input
              value={remoteToken}
              onChange={(e) => setRemoteToken(e.target.value)}
              placeholder="Auth token (optional in dev)"
              inputSize="sm"
              type="password"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Display Name</label>
            <Input
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value)}
              placeholder="Work Machine"
              inputSize="sm"
            />
          </div>
          {error && <p className="text-[11px] text-[var(--accent-red)]">{error}</p>}
          <Button size="sm" onClick={handleConnectRemote} disabled={loading || !remoteHost} className="w-full">
            {loading ? 'Connecting...' : 'Connect'}
          </Button>
        </TabPanel>

        <TabPanel id="tunnel" className="p-4 space-y-3">
          <p className="text-[11px] text-[var(--text-secondary)]">
            Connect to a Core exposed via Cloudflare Tunnel.
          </p>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Tunnel URL</label>
            <Input
              value={tunnelUrl}
              onChange={(e) => setTunnelUrl(e.target.value)}
              placeholder="https://abc-xyz.trycloudflare.com"
              inputSize="sm"
            />
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              Paste the URL shown in the Core's tunnel settings.
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Auth Token</label>
            <Input
              value={tunnelToken}
              onChange={(e) => setTunnelToken(e.target.value)}
              placeholder="Generated on the Core machine"
              inputSize="sm"
              type="password"
            />
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              Generate with <code className="text-[var(--accent-orange)]">nexus-core --generate-token</code> on the Core machine.
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Display Name</label>
            <Input
              value={tunnelName}
              onChange={(e) => setTunnelName(e.target.value)}
              placeholder="Remote Server"
              inputSize="sm"
            />
          </div>
          {error && <p className="text-[11px] text-[var(--accent-red)]">{error}</p>}
          <Button size="sm" onClick={handleConnectTunnel} disabled={loading || !tunnelUrl || !tunnelToken} className="w-full">
            {loading ? 'Connecting...' : 'Connect via Tunnel'}
          </Button>
        </TabPanel>
      </Tabs>
    </Dialog>
  );
}
