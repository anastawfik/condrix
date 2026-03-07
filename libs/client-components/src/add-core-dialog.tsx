import { useState } from 'react';
import { Monitor, Globe } from 'lucide-react';
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

  const resetForm = () => {
    setLocalPort('9100');
    setRemoteHost('');
    setRemotePort('9100');
    setRemoteToken('');
    setRemoteName('');
    setError('');
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add Core" className="w-[420px]">
      <Tabs defaultTab="local">
        <TabList className="px-4">
          <Tab id="local" icon={<Monitor size={12} />}>Local</Tab>
          <Tab id="remote" icon={<Globe size={12} />}>Remote</Tab>
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
      </Tabs>
    </Dialog>
  );
}
