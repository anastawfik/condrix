/**
 * Maestro connection store.
 * Manages a single WebSocket connection to Maestro for auth, core listing,
 * AI config, and message relay.
 */
import { createStore } from 'zustand/vanilla';
import type { MessageEnvelope } from '@condrix/protocol';
import { generateMessageId } from '@condrix/protocol';

export type MaestroConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface MaestroUser {
  username: string;
  role: 'admin' | 'user';
}

export interface MaestroCore {
  id: string;
  coreId: string;
  displayName: string;
  status: 'online' | 'offline';
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface MaestroStore {
  // Connection state
  state: MaestroConnectionState;
  url: string | null;
  sessionToken: string | null;
  user: MaestroUser | null;
  error: string | null;

  // Cores from Maestro
  maestroCores: MaestroCore[];

  // Internal
  _ws: WebSocket | null;
  _pending: Map<string, PendingRequest>;
  _listeners: Map<string, Set<(event: MessageEnvelope) => void>>;

  // Actions
  connect: (url: string) => void;
  login: (url: string, username: string, password: string, totp?: string) => Promise<void>;
  authWithToken: (url: string, sessionToken: string) => Promise<void>;
  logout: () => void;
  disconnect: () => void;

  // Core management
  fetchCores: () => Promise<void>;
  addCore: (coreId: string, displayName: string, accessToken: string) => Promise<void>;
  removeCore: (id: string) => Promise<void>;
  renameCore: (id: string, displayName: string) => Promise<void>;

  // AI config
  getAiConfig: () => Promise<Record<string, unknown>>;
  setAiConfig: (config: Record<string, unknown>) => Promise<void>;

  // Message relay
  requestOnCore: <T = unknown>(
    coreId: string,
    ns: string,
    action: string,
    payload: unknown,
  ) => Promise<T>;
  sendOnCore: (coreId: string, ns: string, action: string, payload: unknown) => void;
  request: <T = unknown>(
    ns: string,
    action: string,
    payload: unknown,
    timeout?: number,
    targetCoreId?: string,
  ) => Promise<T>;
  subscribe: (pattern: string, listener: (event: MessageEnvelope) => void) => () => void;
}

const STORAGE_KEY = 'condrix-maestro-session';
const REQUEST_TIMEOUT = 30_000;

export const createMaestroStore = () =>
  createStore<MaestroStore>((set, get) => ({
    state: 'disconnected',
    url: null,
    sessionToken: null,
    user: null,
    error: null,
    maestroCores: [],
    _ws: null,
    _pending: new Map(),
    _listeners: new Map(),

    connect: (rawUrl) => {
      const { _ws } = get();
      if (_ws) _ws.close();

      // Auto-prefix protocol if missing (prevents treating hostname as relative path)
      let url = rawUrl.trim();
      if (!/^wss?:\/\//i.test(url)) {
        url = `wss://${url}`;
      }

      set({ state: 'connecting', url, error: null });

      const ws = new WebSocket(url);

      // Store immediately so subsequent connect() calls can close a CONNECTING socket
      set({ _ws: ws });

      ws.onopen = () => {
        // Ignore if a newer connect() replaced us
        if (get()._ws !== ws) return;
      };

      ws.onmessage = (event) => {
        // Ignore messages from stale WebSockets
        if (get()._ws !== ws) return;

        let msg: MessageEnvelope;
        try {
          msg = JSON.parse(event.data as string) as MessageEnvelope;
        } catch {
          return;
        }

        // Handle responses
        if (msg.type === 'response' && msg.correlationId) {
          const pending = get()._pending.get(msg.correlationId);
          if (pending) {
            clearTimeout(pending.timer);
            get()._pending.delete(msg.correlationId);
            const resp = msg as MessageEnvelope & {
              success?: boolean;
              error?: { message: string };
            };
            if (resp.success) {
              pending.resolve(msg.payload);
            } else {
              // For login: payload may contain requiresTotp even on failure
              const p = msg.payload as Record<string, unknown> | undefined;
              if (p?.requiresTotp) {
                pending.resolve(msg.payload);
              } else {
                pending.reject(new Error(resp.error?.message ?? 'Request failed'));
              }
            }
          }
          return;
        }

        // Handle events
        if (msg.type === 'event') {
          const eventKey = `${msg.namespace}:${msg.action}`;
          const { _listeners } = get();

          // Update core list on core online/offline events
          if (
            msg.namespace === 'maestro' &&
            (msg.action === 'core.online' || msg.action === 'core.offline')
          ) {
            get()
              .fetchCores()
              .catch(() => {});
          }

          for (const [pattern, listeners] of _listeners) {
            if (matchPattern(pattern, eventKey)) {
              for (const listener of listeners) {
                listener(msg);
              }
            }
          }
        }
      };

      ws.onclose = () => {
        // Ignore close from stale WebSockets — a newer connect() is in progress
        if (get()._ws !== ws) return;

        set({ _ws: null });
        // Reject pending requests
        for (const [id, pending] of get()._pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error('Connection closed'));
          get()._pending.delete(id);
        }
        const currentState = get().state;
        if (currentState !== 'disconnected') {
          set({ state: 'disconnected' });
        }
      };

      ws.onerror = () => {
        // onclose will fire
      };
    },

    login: async (url, username, password, totp) => {
      // Connect if not already
      const { _ws, state } = get();
      if (!_ws || state !== 'connecting') {
        get().connect(url);
        // Wait for connection
        await waitForOpen(get);
      }

      const payload: Record<string, unknown> = { username, password };
      if (totp) payload.totpCode = totp;

      const result = await get().request<{
        authenticated: boolean;
        sessionToken?: string;
        expiresAt?: string;
        requiresTotp?: boolean;
        user?: MaestroUser;
      }>('maestro', 'login', payload);

      if (!result.authenticated) {
        if (result.requiresTotp) {
          throw new Error('TOTP_REQUIRED');
        }
        throw new Error('Authentication failed');
      }

      set({
        state: 'connected',
        sessionToken: result.sessionToken ?? null,
        user: result.user ?? null,
      });

      // Persist session
      try {
        if (typeof localStorage !== 'undefined' && result.sessionToken) {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              url,
              sessionToken: result.sessionToken,
              expiresAt: result.expiresAt,
            }),
          );
        }
      } catch {
        /* storage unavailable */
      }

      // Fetch cores after login
      await get().fetchCores();
    },

    authWithToken: async (url, sessionToken) => {
      get().connect(url);
      await waitForOpen(get);

      const result = await get().request<{
        authenticated: boolean;
        user?: MaestroUser;
      }>('maestro', 'auth', { sessionToken });

      if (!result.authenticated) {
        // Clear saved session
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          /* storage unavailable */
        }
        get().disconnect();
        throw new Error('Session expired');
      }

      set({
        state: 'connected',
        sessionToken,
        user: result.user ?? null,
      });

      await get().fetchCores();
    },

    logout: () => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        /* storage unavailable */
      }
      get().disconnect();
    },

    disconnect: () => {
      const { _ws } = get();
      set({
        state: 'disconnected',
        sessionToken: null,
        user: null,
        maestroCores: [],
        error: null,
        _ws: null,
      });
      if (_ws) _ws.close();
    },

    fetchCores: async () => {
      try {
        const result = await get().request<{ cores: MaestroCore[] }>('maestro', 'cores.list', {});
        set({ maestroCores: result.cores });
      } catch {
        // Non-critical
      }
    },

    addCore: async (coreId, displayName, accessToken) => {
      await get().request('maestro', 'cores.register', { coreId, displayName, accessToken });
      await get().fetchCores();
    },

    removeCore: async (id) => {
      await get().request('maestro', 'cores.remove', { id });
      await get().fetchCores();
    },

    renameCore: async (id, displayName) => {
      await get().request('maestro', 'cores.rename', { id, displayName });
      await get().fetchCores();
    },

    getAiConfig: async () => {
      return get().request<Record<string, unknown>>('maestro', 'ai.config.get', {});
    },

    setAiConfig: async (config) => {
      await get().request('maestro', 'ai.config.set', config);
    },

    requestOnCore: async <T = unknown>(
      coreId: string,
      ns: string,
      action: string,
      payload: unknown,
    ): Promise<T> => {
      return get().request<T>(ns, action, payload, REQUEST_TIMEOUT, coreId);
    },

    sendOnCore: (coreId, ns, action, payload) => {
      const { _ws, state } = get();
      if (state !== 'connected' || !_ws || _ws.readyState !== WebSocket.OPEN) return;

      const msg = {
        id: generateMessageId(),
        type: 'request' as const,
        namespace: ns,
        action,
        payload,
        timestamp: new Date().toISOString(),
        targetCoreId: coreId,
      };
      _ws.send(JSON.stringify(msg));
    },

    request: <T = unknown>(
      ns: string,
      action: string,
      payload: unknown,
      timeout = REQUEST_TIMEOUT,
      targetCoreId?: string,
    ): Promise<T> => {
      return new Promise((resolve, reject) => {
        const { _ws } = get();
        if (!_ws || _ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Not connected to Maestro'));
          return;
        }

        const id = generateMessageId();
        const msg: Record<string, unknown> = {
          id,
          type: 'request',
          namespace: ns,
          action,
          payload,
          timestamp: new Date().toISOString(),
        };
        if (targetCoreId) {
          msg.targetCoreId = targetCoreId;
        }

        const timer = setTimeout(() => {
          get()._pending.delete(id);
          reject(new Error(`Request timeout: ${ns}:${action}`));
        }, timeout);

        get()._pending.set(id, { resolve: resolve as (p: unknown) => void, reject, timer });
        _ws.send(JSON.stringify(msg));
      });
    },

    subscribe: (pattern, listener) => {
      const { _listeners } = get();
      if (!_listeners.has(pattern)) {
        _listeners.set(pattern, new Set());
      }
      _listeners.get(pattern)!.add(listener);

      return () => {
        const listeners = get()._listeners.get(pattern);
        if (listeners) {
          listeners.delete(listener);
          if (listeners.size === 0) {
            get()._listeners.delete(pattern);
          }
        }
      };
    },
  }));

function matchPattern(pattern: string, eventKey: string): boolean {
  if (pattern === '*') return true;
  if (pattern === eventKey) return true;
  if (pattern.endsWith(':*')) {
    return eventKey.startsWith(pattern.slice(0, -1));
  }
  return false;
}

async function waitForOpen(get: () => MaestroStore): Promise<void> {
  const ws = get()._ws;
  if (ws && ws.readyState === WebSocket.OPEN) return;

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const currentWs = get()._ws;
      // WebSocket opened successfully
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        resolve();
        return;
      }
      // WebSocket was closed/replaced — fail fast instead of waiting full timeout
      if (!currentWs || currentWs.readyState === WebSocket.CLOSED) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        reject(new Error('Connection failed'));
        return;
      }
    }, 50);

    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error('Connection timeout'));
    }, 10_000);
  });
}

export const maestroStore = createMaestroStore();

// Auto-restore session from localStorage
try {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { url, sessionToken, expiresAt } = JSON.parse(saved) as {
        url: string;
        sessionToken: string;
        expiresAt?: string;
      };
      // Check if session hasn't expired
      if (!expiresAt || new Date(expiresAt) > new Date()) {
        maestroStore
          .getState()
          .authWithToken(url, sessionToken)
          .catch(() => {
            // Session expired or invalid — silent fail
          });
      }
    }
  }
} catch {
  /* storage unavailable */
}
