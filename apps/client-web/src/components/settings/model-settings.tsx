import { useState, useEffect, useCallback } from 'react';
import { useSettings, multiCoreStore, workspaceStore } from '@condrix/client-shared';

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
];

const MASK_CHAR = '\u2022';

type AuthMethod = 'apikey' | 'oauth';

interface OAuthStatus {
  authenticated: boolean;
  method: 'oauth' | 'apikey' | 'none';
  expiresAt?: string;
}

export function ModelSettings() {
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
  }, []);

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

  const getActiveCoreId = () =>
    workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;

  const fetchOAuthStatus = async () => {
    const coreId = getActiveCoreId();
    if (!coreId) return;
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
      const coreId = getActiveCoreId();
      if (!coreId) throw new Error('No Core connected');
      const result = await multiCoreStore.getState().requestOnCore<{ url: string }>(
        coreId, 'core', 'oauth.login', {},
      );
      // Open the authorization URL in the browser
      window.open(result.url, '_blank', 'noopener');
      setStatus({ type: 'success', message: 'Browser opened — complete sign-in there, then come back.' });

      // Subscribe to the OAuth completion event
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

        // Timeout fallback — stop loading after 5.5 minutes if no event
        setTimeout(() => {
          setOAuthLoading(false);
          unsub();
        }, 5.5 * 60 * 1000);
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
      const coreId = getActiveCoreId();
      if (!coreId) throw new Error('No Core connected');
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
      const coreId = getActiveCoreId();
      if (!coreId) throw new Error('No Core connected');
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
    } catch {
      // Will be saved with the rest on save
    }
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
      setStatus({ type: 'success', message: 'Settings saved' });
      await reload('model.');
      await fetchOAuthStatus();
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-[var(--text-secondary)]">Loading settings...</div>;
  }

  return (
    <div className="p-6 space-y-5 max-w-lg">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Model Settings</h2>

      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">Authentication Method</label>
        <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
          <button
            onClick={() => handleAuthMethodChange('apikey')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              authMethod === 'apikey'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            API Key
          </button>
          <button
            onClick={() => handleAuthMethodChange('oauth')}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              authMethod === 'oauth'
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            Claude Plan (OAuth)
          </button>
        </div>
      </div>

      {authMethod === 'apikey' && (
        <div className="space-y-1.5">
          <label className="block text-sm text-[var(--text-secondary)]">Anthropic API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
      )}

      {authMethod === 'oauth' && (
        <div className="space-y-3">
          <div className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Status</span>
              <span className={`text-sm font-medium ${
                oauthStatus?.authenticated && oauthStatus?.method === 'oauth'
                  ? 'text-[var(--accent-green)]'
                  : 'text-[var(--accent-red)]'
              }`}>
                {oauthStatus?.authenticated && oauthStatus?.method === 'oauth'
                  ? 'Authenticated'
                  : 'Not authenticated'}
              </span>
            </div>
            {oauthStatus?.expiresAt && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-[var(--text-secondary)]">Expires</span>
                <span className="text-sm text-[var(--text-secondary)]">
                  {new Date(oauthStatus.expiresAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleBrowserLogin}
            disabled={oauthLoading}
            className="w-full px-4 py-2.5 rounded bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 transition-colors"
          >
            {oauthLoading ? 'Waiting for sign-in...' : 'Sign in with Claude'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleImportOAuth}
              disabled={oauthLoading}
              className="px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm hover:opacity-90 disabled:opacity-50"
            >
              Import from Claude Code
            </button>
            <button
              onClick={handleRefreshOAuth}
              disabled={oauthLoading || !(oauthStatus?.authenticated && oauthStatus?.method === 'oauth')}
              className="px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm hover:opacity-90 disabled:opacity-50"
            >
              Refresh Token
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Works with Claude Pro, Max, and Team plans. Opens your browser to sign in.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">Max Output Tokens</label>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          min={1}
          max={128000}
          className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          placeholder="Optional system prompt for all conversations..."
          className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm resize-y focus:outline-none focus:border-[var(--accent-blue)]"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {status && (
          <span className={`text-sm ${status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
