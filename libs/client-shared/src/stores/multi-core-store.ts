/**
 * Multi-Core connection orchestrator.
 * Manages simultaneous WebSocket connections to multiple Core instances.
 */
import { createStore } from 'zustand/vanilla';
import type { CoreInfo } from '@condrix/protocol';

import type { MessageEnvelope } from '@condrix/protocol';
import { createConnectionStore, type ConnectionStore, type ConnectionState } from './connection-store.js';
import { coreRegistryStore, type CoreEntry } from './core-registry-store.js';
import { maestroStore } from './maestro-store.js';

export interface CoreConnection {
  id: string;
  store: ReturnType<typeof createConnectionStore>;
  coreInfo: CoreInfo | null;
  connState: ConnectionState;
}

export interface MultiCoreStore {
  connections: Map<string, CoreConnection>;
  activeCoreId: string | null;

  connectCore: (entry: CoreEntry) => void;
  disconnectCore: (coreId: string) => void;
  disconnectAll: () => void;
  setActiveCoreId: (coreId: string | null) => void;
  getConnection: (coreId: string) => CoreConnection | undefined;
  getActiveConnection: () => CoreConnection | undefined;
  requestOnCore: <T = unknown>(coreId: string, ns: string, action: string, payload: unknown, timeout?: number) => Promise<T>;
  subscribeOnCore: (coreId: string, pattern: string, listener: (event: MessageEnvelope) => void) => () => void;
  sendOnCore: (coreId: string, ns: string, action: string, payload: unknown) => void;
  autoConnectAll: () => void;
}

export const createMultiCoreStore = () =>
  createStore<MultiCoreStore>((set, get) => ({
    connections: new Map(),
    activeCoreId: null,

    connectCore: (entry) => {
      const { connections } = get();
      if (connections.has(entry.id)) return;

      const store = createConnectionStore();
      const conn: CoreConnection = { id: entry.id, store, coreInfo: null, connState: 'disconnected' };

      const newMap = new Map(connections);
      newMap.set(entry.id, conn);
      set({ connections: newMap });

      // Subscribe to coreInfo and connection state updates
      store.subscribe((state) => {
        const { connections: current } = get();
        const existing = current.get(entry.id);
        if (!existing) return;

        if (state.state !== existing.connState || (state.coreInfo && state.coreInfo !== existing.coreInfo)) {
          const updated = new Map(current);
          updated.set(entry.id, {
            ...existing,
            connState: state.state,
            coreInfo: state.coreInfo ?? existing.coreInfo,
          });
          set({ connections: updated });
        }
      });

      // Connect
      store.getState().connect({
        url: entry.url,
        token: entry.token ?? '',
        autoReconnect: true,
      });

      // Update lastConnected
      coreRegistryStore.getState().updateCore(entry.id, {
        lastConnected: new Date().toISOString(),
      });

      // Auto-set active if none
      if (!get().activeCoreId) {
        set({ activeCoreId: entry.id });
      }
    },

    disconnectCore: (coreId) => {
      const { connections, activeCoreId } = get();
      const conn = connections.get(coreId);
      if (!conn) return;

      conn.store.getState().disconnect();
      const newMap = new Map(connections);
      newMap.delete(coreId);
      set({
        connections: newMap,
        activeCoreId: activeCoreId === coreId ? (newMap.size > 0 ? newMap.keys().next().value ?? null : null) : activeCoreId,
      });
    },

    disconnectAll: () => {
      const { connections } = get();
      for (const conn of connections.values()) {
        conn.store.getState().disconnect();
      }
      set({ connections: new Map(), activeCoreId: null });
    },

    setActiveCoreId: (coreId) => {
      set({ activeCoreId: coreId });
    },

    getConnection: (coreId) => {
      return get().connections.get(coreId);
    },

    getActiveConnection: () => {
      const { activeCoreId, connections } = get();
      if (!activeCoreId) return undefined;
      return connections.get(activeCoreId);
    },

    requestOnCore: async <T = unknown>(coreId: string, ns: string, action: string, payload: unknown, timeout?: number): Promise<T> => {
      // Maestro mode: route through Maestro if connected
      const maestro = maestroStore.getState();
      if (maestro.state === 'connected') {
        return maestro.request<T>(ns, action, payload, timeout, coreId);
      }

      // Direct mode: use direct Core WebSocket
      const conn = get().connections.get(coreId);
      if (!conn) throw new Error(`No connection for core ${coreId}`);
      return conn.store.getState().request<T>(ns, action, payload, timeout);
    },

    subscribeOnCore: (coreId, pattern, listener) => {
      // Maestro mode: subscribe through Maestro relay
      const maestro = maestroStore.getState();
      if (maestro.state === 'connected') {
        return maestro.subscribe(pattern, listener);
      }

      // Direct mode: subscribe on direct Core connection
      const conn = get().connections.get(coreId);
      if (!conn) return () => {};
      return conn.store.getState().subscribe(pattern, listener);
    },

    sendOnCore: (coreId, ns, action, payload) => {
      // Maestro mode
      const maestro = maestroStore.getState();
      if (maestro.state === 'connected') {
        maestro.sendOnCore(coreId, ns, action, payload);
        return;
      }

      // Direct mode
      const conn = get().connections.get(coreId);
      if (!conn) throw new Error(`No connection for core ${coreId}`);
      conn.store.getState().send({
        id: `msg_${Date.now()}`,
        type: 'request',
        namespace: ns,
        action,
        payload,
        timestamp: new Date().toISOString(),
      });
    },

    autoConnectAll: () => {
      const entries = coreRegistryStore.getState().cores;
      for (const entry of entries) {
        if ((entry as CoreEntry & { autoConnect?: boolean }).autoConnect !== false) {
          get().connectCore(entry);
        }
      }
    },
  }));

export const multiCoreStore = createMultiCoreStore();
