import { useState, useEffect } from 'react';
import { maestroStore } from '@nexus-core/client-shared';
import type { MaestroConnectionState } from '@nexus-core/client-shared';
import { cn } from './lib/utils.js';
import { Button } from './button.js';

/**
 * Authentication Settings Tab — Maestro account self-service.
 * Change password, setup/enable/disable TOTP, view session info.
 * Only visible when connected to Maestro.
 */
export function AuthenticationSettingsTab() {
  const [maestroState, setMaestroState] = useState<MaestroConnectionState>(
    () => maestroStore.getState().state,
  );

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => setMaestroState(s.state));
    return unsub;
  }, []);

  if (maestroState !== 'connected') {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          Connect to Maestro to manage your account.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-4 space-y-6">
      <SessionInfoSection />
      <ChangePasswordSection />
      <TotpSection />
    </div>
  );
}

/* ─── Session Info ──────────────────────────────────────────────────────── */

function SessionInfoSection() {
  const [user, setUser] = useState(() => maestroStore.getState().user);
  const [url, setUrl] = useState(() => maestroStore.getState().url);

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => {
      setUser(s.user);
      setUrl(s.url);
    });
    return unsub;
  }, []);

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Session</h3>
      <div className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-muted)]">Username</span>
          <span className="text-[var(--text-primary)] font-medium">{user?.username}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-muted)]">Role</span>
          <span className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-medium',
            user?.role === 'admin'
              ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
          )}>
            {user?.role}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-muted)]">Maestro URL</span>
          <code className="text-[var(--text-primary)] font-mono bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[10px]">
            {url}
          </code>
        </div>
      </div>
    </div>
  );
}

/* ─── Change Password ───────────────────────────────────────────────────── */

function ChangePasswordSection() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setStatus({ type: 'error', message: 'All fields are required' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 4) {
      setStatus({ type: 'error', message: 'Password must be at least 4 characters' });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      await maestroStore.getState().request('maestro', 'auth.changePassword', {
        oldPassword,
        newPassword,
      });
      setStatus({ type: 'success', message: 'Password changed successfully' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Change Password</h3>
      <div className="space-y-2">
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Current Password</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[var(--text-secondary)]">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Changing...' : 'Change Password'}
          </Button>
          {status && (
            <span className={cn('text-[11px]', status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]')}>
              {status.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── TOTP Section ──────────────────────────────────────────────────────── */

function TotpSection() {
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDisable, setShowDisable] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);

  // Fetch TOTP status on mount
  useEffect(() => {
    maestroStore.getState().request<{ enabled: boolean }>(
      'maestro', 'auth.totp.status', {},
    ).then((result) => {
      setTotpEnabled(result.enabled);
    }).catch(() => {
      setTotpEnabled(false);
    });
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const result = await maestroStore.getState().request<{ secret: string; otpauthUri: string }>(
        'maestro', 'auth.totp.setup', {},
      );
      setSetupData(result);

      // Generate QR code data URL from otpauthUri
      try {
        const QRCode = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(result.otpauthUri, {
          width: 200,
          margin: 2,
          color: { dark: '#ffffff', light: '#00000000' },
        });
        setQrDataUrl(dataUrl);
      } catch {
        // QR generation failed — user can still enter secret manually
      }
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!verifyCode.trim()) {
      setStatus({ type: 'error', message: 'Enter the verification code' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await maestroStore.getState().request<{ enabled: boolean }>(
        'maestro', 'auth.totp.enable', { code: verifyCode.trim() },
      );
      if (result.enabled) {
        setStatus({ type: 'success', message: 'TOTP enabled successfully' });
        setSetupData(null);
        setQrDataUrl(null);
        setVerifyCode('');
        setTotpEnabled(true);
      } else {
        setStatus({ type: 'error', message: 'Invalid verification code' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword.trim()) {
      setStatus({ type: 'error', message: 'Enter your password to disable TOTP' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      await maestroStore.getState().request('maestro', 'auth.totp.disable', { password: disablePassword });
      setStatus({ type: 'success', message: 'TOTP disabled' });
      setShowDisable(false);
      setDisablePassword('');
      setTotpEnabled(false);
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Two-Factor Authentication</h3>

      {!setupData ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {!totpEnabled && (
              <Button size="sm" variant="secondary" onClick={handleSetup} disabled={loading}>
                {loading ? 'Setting up...' : 'Setup TOTP'}
              </Button>
            )}
            {totpEnabled && (
              <Button size="sm" variant="danger" onClick={() => setShowDisable(!showDisable)}>
                {showDisable ? 'Cancel' : 'Disable TOTP'}
              </Button>
            )}
          </div>

          {totpEnabled && !showDisable && (
            <p className="text-[11px] text-[var(--accent-green)]">TOTP is enabled for your account.</p>
          )}

          {totpEnabled === false && !loading && (
            <p className="text-[11px] text-[var(--text-muted)]">TOTP is not enabled. Set up two-factor authentication for additional security.</p>
          )}

          {showDisable && (
            <div className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] space-y-2">
              <p className="text-[11px] text-[var(--text-secondary)]">Enter your password to confirm disabling TOTP.</p>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Password"
                className="w-full px-2 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)]"
              />
              <Button size="sm" variant="danger" onClick={handleDisable} disabled={loading}>
                {loading ? 'Disabling...' : 'Confirm Disable'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] space-y-3">
            <p className="text-[11px] text-[var(--text-secondary)]">
              Scan the QR code with your authenticator app:
            </p>

            {qrDataUrl && (
              <div className="flex justify-center py-2">
                <img src={qrDataUrl} alt="TOTP QR Code" width={200} height={200} className="rounded" />
              </div>
            )}

            <p className="text-[10px] text-[var(--text-muted)]">
              Or enter this secret manually:
            </p>
            <code className="block text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-1.5 rounded break-all select-all">
              {setupData.secret}
            </code>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Verification Code</label>
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent-blue)] font-mono tracking-wider"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleEnable} disabled={loading}>
              {loading ? 'Verifying...' : 'Enable TOTP'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setSetupData(null); setQrDataUrl(null); setVerifyCode(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status && (
        <p className={cn('text-[11px] mt-2', status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]')}>
          {status.message}
        </p>
      )}
    </div>
  );
}
