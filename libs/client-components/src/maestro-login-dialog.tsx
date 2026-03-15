import { useState } from 'react';
import { maestroStore } from '@nexus-core/client-shared';
import { cn } from './lib/utils.js';
import { Button } from './button.js';

export interface MaestroLoginDialogProps {
  open: boolean;
  onClose: () => void;
  onDirectConnect: () => void;
}

/**
 * Login dialog for connecting to Maestro.
 * Shows username/password fields with optional TOTP.
 * Also offers a "direct connect" fallback.
 */
export function MaestroLoginDialog({ open, onClose, onDirectConnect }: MaestroLoginDialogProps) {
  const [url, setUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus-maestro-url');
      return saved ?? '';
    } catch {
      return '';
    }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleLogin = async () => {
    if (!url.trim() || !username.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save URL for next time
      try { localStorage.setItem('nexus-maestro-url', url.trim()); } catch { /* ignore */ }

      await maestroStore.getState().login(
        url.trim(),
        username.trim(),
        password,
        showTotp ? totpCode.trim() : undefined,
      );

      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'TOTP_REQUIRED') {
        setShowTotp(true);
        setError('Enter your TOTP code');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[380px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Sign In to NexusCore</h2>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Connect to Maestro for centralized Core management.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 pb-4 space-y-3">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Maestro URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://localhost:9200"
              autoFocus
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          {showTotp && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[var(--text-secondary)]">TOTP Code</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                autoFocus
                className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)] font-mono tracking-wider"
              />
            </div>
          )}

          {error && (
            <p className="text-[11px] text-[var(--accent-red)]">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </div>

        {/* Divider */}
        <div className="px-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border-color)]" />
          <span className="text-[10px] text-[var(--text-muted)]">or</span>
          <div className="flex-1 h-px bg-[var(--border-color)]" />
        </div>

        {/* Direct connect option */}
        <div className="px-6 pt-3 pb-5">
          <button
            onClick={onDirectConnect}
            className="w-full px-3 py-2 rounded border border-[var(--border-color)] text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-hover)] transition-colors"
          >
            Connect directly to a Core
          </button>
        </div>
      </div>
    </div>
  );
}
