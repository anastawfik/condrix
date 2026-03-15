import { useState, useEffect } from 'react';
import { cn } from './lib/utils.js';
import { Button } from './button.js';

type AuthMethod = 'apikey' | 'oauth';

const MASK_CHAR = '\u2022';

interface OAuthStatus {
  authenticated: boolean;
  method: 'oauth' | 'apikey' | 'none';
  expiresAt?: string;
}

export interface AuthConfigSectionProps {
  onSave: (config: { method: 'apikey' | 'oauth'; apiKey?: string }) => Promise<void>;
  onOAuthLogin: () => Promise<{ url: string }>;
  onOAuthImport?: () => Promise<{ success: boolean; message: string }>;
  onOAuthRefresh?: () => Promise<{ success: boolean }>;
  onOAuthStatus?: () => Promise<OAuthStatus>;
  /** Called when OAuth login completes (browser callback received). */
  onOAuthComplete?: (handler: (result: { success: boolean; message: string }) => void) => (() => void);
  initialMethod?: 'apikey' | 'oauth';
  initialApiKey?: string;
  saveLabel?: string;
}

export function AuthConfigSection({
  onSave,
  onOAuthLogin,
  onOAuthImport,
  onOAuthRefresh,
  onOAuthStatus,
  onOAuthComplete,
  initialMethod = 'apikey',
  initialApiKey = '',
  saveLabel = 'Save',
}: AuthConfigSectionProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initialMethod);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null);
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchOAuthStatus();
  }, []);

  useEffect(() => {
    setAuthMethod(initialMethod);
  }, [initialMethod]);

  useEffect(() => {
    if (initialApiKey) setApiKey(initialApiKey);
  }, [initialApiKey]);

  const fetchOAuthStatus = async () => {
    if (!onOAuthStatus) return;
    try {
      const result = await onOAuthStatus();
      setOAuthStatus(result);
    } catch {
      // Non-critical
    }
  };

  const handleBrowserLogin = async () => {
    setOAuthLoading(true);
    setStatus(null);
    try {
      const result = await onOAuthLogin();
      window.open(result.url, '_blank', 'noopener');
      setStatus({ type: 'success', message: 'Browser opened -- complete sign-in there.' });

      // Listen for completion
      if (onOAuthComplete) {
        const unsub = onOAuthComplete((completionResult) => {
          setStatus({ type: completionResult.success ? 'success' : 'error', message: completionResult.message });
          setOAuthLoading(false);
          if (completionResult.success) {
            setAuthMethod('oauth');
            fetchOAuthStatus();
          }
          unsub();
        });
        // Timeout fallback
        setTimeout(() => { setOAuthLoading(false); unsub(); }, 5.5 * 60 * 1000);
      } else {
        // No completion listener — just set a timeout
        setTimeout(() => setOAuthLoading(false), 30_000);
      }
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
      setOAuthLoading(false);
    }
  };

  const handleImportOAuth = async () => {
    if (!onOAuthImport) return;
    setOAuthLoading(true);
    setStatus(null);
    try {
      const result = await onOAuthImport();
      setStatus({ type: result.success ? 'success' : 'error', message: result.message });
      if (result.success) {
        setAuthMethod('oauth');
        await fetchOAuthStatus();
      }
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setOAuthLoading(false);
    }
  };

  const handleRefreshOAuth = async () => {
    if (!onOAuthRefresh) return;
    setOAuthLoading(true);
    setStatus(null);
    try {
      const result = await onOAuthRefresh();
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

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const config: { method: AuthMethod; apiKey?: string } = { method: authMethod };
      if (authMethod === 'apikey' && !apiKey.startsWith(MASK_CHAR) && apiKey.trim()) {
        config.apiKey = apiKey.trim();
      }
      await onSave(config);
      setStatus({ type: 'success', message: 'Saved' });
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Auth method toggle */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Method</label>
        <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
          <button
            onClick={() => setAuthMethod('apikey')}
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
            onClick={() => setAuthMethod('oauth')}
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
              <span
                className={cn(
                  'text-[11px] font-medium',
                  oauthStatus?.authenticated && oauthStatus?.method === 'oauth'
                    ? 'text-[var(--accent-green)]'
                    : 'text-[var(--accent-red)]',
                )}
              >
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
            {onOAuthImport && (
              <button
                onClick={handleImportOAuth}
                disabled={oauthLoading}
                className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] hover:opacity-90 disabled:opacity-50"
              >
                Import from Claude Code
              </button>
            )}
            {onOAuthRefresh && (
              <button
                onClick={handleRefreshOAuth}
                disabled={oauthLoading || !(oauthStatus?.authenticated && oauthStatus?.method === 'oauth')}
                className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] hover:opacity-90 disabled:opacity-50"
              >
                Refresh Token
              </button>
            )}
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : saveLabel}
        </Button>
        {status && (
          <span
            className={cn(
              'text-[11px]',
              status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]',
            )}
          >
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
