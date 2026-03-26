import { useState, useEffect, useCallback } from 'react';
import {
  maestroStore, multiCoreStore,
} from '@condrix/client-shared';
import type { MaestroConnectionState } from '@condrix/client-shared';
import { cn } from './lib/utils.js';
import { AuthConfigSection } from './auth-config-section.js';

const MASK_CHAR = '\u2022';
const DIRECT_AUTH_KEY = 'condrix-direct-auth';

/**
 * AI Settings Tab — unified Claude auth configuration.
 * Routes to Maestro or client localStorage depending on connection mode.
 */
export function AiSettingsTab() {
  const [maestroState, setMaestroState] = useState<MaestroConnectionState>(
    () => maestroStore.getState().state,
  );

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => setMaestroState(s.state));
    return unsub;
  }, []);

  if (maestroState === 'connected') {
    return <MaestroAiConfig />;
  }

  return <DirectAiConfig />;
}

/* ─── Maestro Mode ──────────────────────────────────────────────────────── */

function MaestroAiConfig() {
  const [initialMethod, setInitialMethod] = useState<'apikey' | 'oauth'>('apikey');
  const [initialApiKey, setInitialApiKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = await maestroStore.getState().getAiConfig();
      if (config.method === 'apikey' || config.method === 'oauth') {
        setInitialMethod(config.method as 'apikey' | 'oauth');
      }
      if (config.apiKey && typeof config.apiKey === 'string') setInitialApiKey(config.apiKey as string);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (config: { method: 'apikey' | 'oauth'; apiKey?: string }) => {
    const payload: Record<string, unknown> = { method: config.method };
    if (config.apiKey && !config.apiKey.startsWith(MASK_CHAR)) {
      payload.apiKey = config.apiKey;
    }
    await maestroStore.getState().setAiConfig(payload);
  };

  const handleOAuthLogin = async () => {
    return maestroStore.getState().request<{ url: string }>('maestro', 'ai.oauth.login', {});
  };

  const handleOAuthStatus = async () => {
    return maestroStore.getState().request<{ authenticated: boolean; method: 'oauth' | 'apikey' | 'none'; expiresAt?: string }>('maestro', 'ai.oauth.status', {});
  };

  const handleOAuthImport = async () => {
    return maestroStore.getState().request<{ success: boolean; message: string }>('maestro', 'ai.oauth.import', {});
  };

  const handleOAuthRefresh = async () => {
    return maestroStore.getState().request<{ success: boolean }>('maestro', 'ai.oauth.refresh', {});
  };

  const handleOAuthComplete = (handler: (result: { success: boolean; message: string }) => void) => {
    return maestroStore.getState().subscribe('maestro:ai.oauthComplete', (event) => {
      handler(event.payload as { success: boolean; message: string });
    });
  };

  if (loading) {
    return <p className="text-xs text-[var(--text-muted)] px-6 py-4">Loading AI config...</p>;
  }

  return (
    <div className="px-6 py-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Claude AI Configuration</h3>
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
          Managed by Maestro. Auth is pushed to all connected Cores.
        </p>
      </div>

      <AuthConfigSection
        onSave={handleSave}
        onOAuthLogin={handleOAuthLogin}
        onOAuthStatus={handleOAuthStatus}
        onOAuthImport={handleOAuthImport}
        onOAuthRefresh={handleOAuthRefresh}
        onOAuthComplete={handleOAuthComplete}
        initialMethod={initialMethod}
        initialApiKey={initialApiKey}
        saveLabel="Save & Push to Cores"
      />
    </div>
  );
}

/* ─── Direct Mode ───────────────────────────────────────────────────────── */

function DirectAiConfig() {
  const [initialMethod, setInitialMethod] = useState<'apikey' | 'oauth'>('apikey');
  const [initialApiKey, setInitialApiKey] = useState('');

  // Load saved direct auth from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DIRECT_AUTH_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { method?: string; apiKey?: string };
        if (parsed.method === 'apikey' || parsed.method === 'oauth') setInitialMethod(parsed.method);
        if (parsed.apiKey) setInitialApiKey(parsed.apiKey);
      }
    } catch { /* ignore */ }

    // Also try to load from first connected Core
    loadFromCore();
  }, []);

  const loadFromCore = async () => {
    const connections = multiCoreStore.getState().connections;
    const firstCoreId = connections.keys().next().value;
    if (!firstCoreId) return;

    try {
      const authResult = await multiCoreStore.getState().requestOnCore<{ key: string; value: unknown }>(
        firstCoreId, 'core', 'config.get', { key: 'auth.method' },
      );
      if (authResult.value === 'apikey' || authResult.value === 'oauth') {
        setInitialMethod(authResult.value as 'apikey' | 'oauth');
      }
    } catch { /* ignore */ }
  };

  const handleSave = async (config: { method: 'apikey' | 'oauth'; apiKey?: string }) => {
    // Store in localStorage
    try {
      const saved: Record<string, unknown> = { method: config.method };
      if (config.apiKey) saved.apiKey = config.apiKey;
      localStorage.setItem(DIRECT_AUTH_KEY, JSON.stringify(saved));
    } catch { /* ignore */ }

    // Push to ALL connected Cores
    const connections = multiCoreStore.getState().connections;
    for (const [coreId] of connections) {
      try {
        await multiCoreStore.getState().requestOnCore(coreId, 'core', 'config.set', { key: 'auth.method', value: config.method });
        if (config.method === 'apikey' && config.apiKey) {
          await multiCoreStore.getState().requestOnCore(coreId, 'core', 'config.set', { key: 'model.apiKey', value: config.apiKey });
        }
      } catch {
        // Core may be offline
      }
    }
  };

  const handleOAuthLogin = async () => {
    const connections = multiCoreStore.getState().connections;
    const firstCoreId = connections.keys().next().value;
    if (!firstCoreId) throw new Error('No Core connected');
    return multiCoreStore.getState().requestOnCore<{ url: string }>(firstCoreId, 'core', 'oauth.login', {});
  };

  const handleOAuthStatus = async () => {
    const connections = multiCoreStore.getState().connections;
    const firstCoreId = connections.keys().next().value;
    if (!firstCoreId) return { authenticated: false, method: 'none' as const };
    return multiCoreStore.getState().requestOnCore<{ authenticated: boolean; method: 'oauth' | 'apikey' | 'none'; expiresAt?: string }>(
      firstCoreId, 'core', 'config.oauthStatus', {},
    );
  };

  const handleOAuthImport = async () => {
    const connections = multiCoreStore.getState().connections;
    const firstCoreId = connections.keys().next().value;
    if (!firstCoreId) throw new Error('No Core connected');
    return multiCoreStore.getState().requestOnCore<{ success: boolean; message: string }>(firstCoreId, 'core', 'config.importOAuth', {});
  };

  const handleOAuthRefresh = async () => {
    const connections = multiCoreStore.getState().connections;
    const firstCoreId = connections.keys().next().value;
    if (!firstCoreId) throw new Error('No Core connected');
    return multiCoreStore.getState().requestOnCore<{ success: boolean }>(firstCoreId, 'core', 'config.refreshOAuth', {});
  };

  const handleOAuthComplete = (handler: (result: { success: boolean; message: string }) => void) => {
    const connections = multiCoreStore.getState().connections;
    const firstCoreId = connections.keys().next().value;
    if (!firstCoreId) return () => {};

    const conn = multiCoreStore.getState().getConnection(firstCoreId);
    if (!conn) return () => {};

    return conn.store.getState().subscribe('core:oauthComplete', (event) => {
      const payload = event.payload as { success: boolean; message: string; accessToken?: string; refreshToken?: string; expiresAt?: string };
      handler(payload);

      // If successful, store tokens in localStorage and push to other Cores
      if (payload.success && payload.accessToken) {
        try {
          localStorage.setItem(DIRECT_AUTH_KEY, JSON.stringify({
            method: 'oauth',
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            expiresAt: payload.expiresAt,
          }));
        } catch { /* ignore */ }

        // Push to other connected Cores
        for (const [coreId] of multiCoreStore.getState().connections) {
          if (coreId === firstCoreId) continue;
          try {
            multiCoreStore.getState().requestOnCore(coreId, 'core', 'config.set', { key: 'auth.method', value: 'oauth' });
            multiCoreStore.getState().requestOnCore(coreId, 'core', 'config.set', { key: 'oauth.accessToken', value: payload.accessToken });
            if (payload.refreshToken) {
              multiCoreStore.getState().requestOnCore(coreId, 'core', 'config.set', { key: 'oauth.refreshToken', value: payload.refreshToken });
            }
          } catch { /* ignore */ }
        }
      }
    });
  };

  const hasConnectedCore = multiCoreStore.getState().connections.size > 0;

  if (!hasConnectedCore) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          Connect to a Core to configure AI authentication.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Claude AI Configuration</h3>
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
          Managed locally. Auth is pushed to all connected Cores.
        </p>
      </div>

      <AuthConfigSection
        onSave={handleSave}
        onOAuthLogin={handleOAuthLogin}
        onOAuthStatus={handleOAuthStatus}
        onOAuthImport={handleOAuthImport}
        onOAuthRefresh={handleOAuthRefresh}
        onOAuthComplete={handleOAuthComplete}
        initialMethod={initialMethod}
        initialApiKey={initialApiKey}
        saveLabel="Save & Push to Cores"
      />
    </div>
  );
}
