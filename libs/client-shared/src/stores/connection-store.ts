/**
 * WebSocket connection state management.
 * Handles connect/disconnect, auth handshake, reconnection, request/response correlation.
 */
import { createStore } from 'zustand/vanilla';
import type { CoreInfo, AuthScope, MessageEnvelope } from '@nexus-core/protocol';
import { generateMessageId } from '@nexus-core/protocol';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionConfig {
  url: string;
  token: string;
  autoReconnect?: boolean;
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface ConnectionStore {
  state: ConnectionState;
  coreInfo: CoreInfo | null;
  sessionId: string | null;
  scopes: AuthScope[];
  error: string | null;

  // Internal
  _ws: WebSocket | null;
  _config: ConnectionConfig | null;
  _pending: Map<string, PendingRequest>;
  _listeners: Map<string, Set<(event: MessageEnvelope) => void>>;
  _reconnectAttempt: number;
  _reconnectTimer: ReturnType<typeof setTimeout> | null;
  _heartbeatTimer: ReturnType<typeof setInterval> | null;

  // Actions
  connect: (config: ConnectionConfig) => void;
  disconnect: () => void;
  send: (message: unknown) => void;
  request: <T = unknown>(namespace: string, action: string, payload: unknown, timeout?: number) => Promise<T>;
  subscribe: (pattern: string, listener: (event: MessageEnvelope) => void) => () => void;
}

const REQUEST_TIMEOUT = 30_000;
const HEARTBEAT_INTERVAL = 30_000;
const MAX_RECONNECT_DELAY = 30_000;

export const createConnectionStore = () =>
  createStore<ConnectionStore>((set, get) => ({
    state: 'disconnected',
    coreInfo: null,
    sessionId: null,
    scopes: [],
    error: null,

    _ws: null,
    _config: null,
    _pending: new Map(),
    _listeners: new Map(),
    _reconnectAttempt: 0,
    _reconnectTimer: null,
    _heartbeatTimer: null,

    connect: (config) => {
      const { _ws } = get();
      if (_ws) _ws.close();

      set({ state: 'connecting', _config: config, error: null });

      const ws = new WebSocket(config.url);

      ws.onopen = () => {
        set({ _ws: ws, _reconnectAttempt: 0 });
        // Send auth request
        const authMsg = {
          id: generateMessageId(),
          type: 'request' as const,
          namespace: 'core',
          action: 'auth',
          payload: { token: config.token },
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(authMsg));
      };

      ws.onmessage = (event) => {
        let msg: MessageEnvelope;
        try {
          msg = JSON.parse(event.data as string) as MessageEnvelope;
        } catch {
          return;
        }

        // Handle auth response
        if (msg.namespace === 'core' && msg.action === 'auth' && msg.type === 'response') {
          const payload = msg.payload as { authenticated?: boolean; scopes?: AuthScope[]; sessionId?: string };
          const resp = msg as MessageEnvelope & { success?: boolean; error?: { message: string } };
          if (resp.success && payload.authenticated) {
            set({
              state: 'connected',
              sessionId: payload.sessionId ?? null,
              scopes: payload.scopes ?? [],
            });
            // Fetch core info
            get().request<CoreInfo>('core', 'info', {}).then((info) => {
              set({ coreInfo: info });
            }).catch(() => { /* non-critical */ });
            // Start heartbeat
            startHeartbeat(get, set);
          } else {
            set({
              state: 'disconnected',
              error: resp.error?.message ?? 'Authentication failed',
            });
            ws.close();
          }
          return;
        }

        // Handle response (correlationId-based)
        if (msg.type === 'response' && msg.correlationId) {
          const pending = get()._pending.get(msg.correlationId);
          if (pending) {
            clearTimeout(pending.timer);
            get()._pending.delete(msg.correlationId);
            const resp = msg as MessageEnvelope & { success?: boolean; error?: { code: string; message: string } };
            if (resp.success) {
              pending.resolve(msg.payload);
            } else {
              pending.reject(new Error(resp.error?.message ?? 'Request failed'));
            }
          }
          return;
        }

        // Handle events — dispatch to listeners
        if (msg.type === 'event') {
          const eventKey = `${msg.namespace}:${msg.action}`;
          const { _listeners } = get();

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
        const { _heartbeatTimer, _config } = get();
        if (_heartbeatTimer) clearInterval(_heartbeatTimer);
        set({ _ws: null, _heartbeatTimer: null });

        // Reject all pending requests
        for (const [id, pending] of get()._pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error('Connection closed'));
          get()._pending.delete(id);
        }

        const currentState = get().state;
        if (currentState !== 'disconnected' && _config?.autoReconnect !== false) {
          scheduleReconnect(get, set);
        } else {
          set({ state: 'disconnected' });
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    },

    disconnect: () => {
      const { _ws, _reconnectTimer, _heartbeatTimer } = get();
      if (_reconnectTimer) clearTimeout(_reconnectTimer);
      if (_heartbeatTimer) clearInterval(_heartbeatTimer);
      set({
        state: 'disconnected',
        coreInfo: null,
        sessionId: null,
        scopes: [],
        error: null,
        _reconnectTimer: null,
        _heartbeatTimer: null,
        _reconnectAttempt: 0,
      });
      if (_ws) _ws.close();
    },

    send: (message) => {
      const { _ws } = get();
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        _ws.send(JSON.stringify(message));
      }
    },

    request: (namespace, action, payload, timeout = REQUEST_TIMEOUT) => {
      return new Promise((resolve, reject) => {
        const { _ws, state } = get();
        if (state !== 'connected' || !_ws || _ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Not connected'));
          return;
        }

        const id = generateMessageId();
        const msg = {
          id,
          type: 'request' as const,
          namespace,
          action,
          payload,
          timestamp: new Date().toISOString(),
        };

        const timer = setTimeout(() => {
          get()._pending.delete(id);
          reject(new Error(`Request timeout: ${namespace}:${action}`));
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

      // Request server-side subscription
      const { _ws, state } = get();
      if (state === 'connected' && _ws && _ws.readyState === WebSocket.OPEN) {
        const msg = {
          id: generateMessageId(),
          type: 'request' as const,
          namespace: 'core',
          action: 'subscribe',
          payload: { subscribe: [pattern] },
          timestamp: new Date().toISOString(),
        };
        _ws.send(JSON.stringify(msg));
      }

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

function scheduleReconnect(
  get: () => ConnectionStore,
  set: (partial: Partial<ConnectionStore>) => void,
): void {
  const attempt = get()._reconnectAttempt;
  const delay = Math.min(1000 * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
  set({ state: 'reconnecting', _reconnectAttempt: attempt + 1 });

  const timer = setTimeout(() => {
    const config = get()._config;
    if (config) {
      get().connect(config);
    }
  }, delay);
  set({ _reconnectTimer: timer });
}

function startHeartbeat(
  get: () => ConnectionStore,
  set: (partial: Partial<ConnectionStore>) => void,
): void {
  const timer = setInterval(() => {
    const { _ws, state } = get();
    if (state === 'connected' && _ws && _ws.readyState === WebSocket.OPEN) {
      const msg = {
        id: generateMessageId(),
        type: 'request',
        namespace: 'core',
        action: 'health',
        payload: {},
        timestamp: new Date().toISOString(),
      };
      _ws.send(JSON.stringify(msg));
    }
  }, HEARTBEAT_INTERVAL);
  set({ _heartbeatTimer: timer });
}

/** Default singleton store instance */
export const connectionStore = createConnectionStore();
