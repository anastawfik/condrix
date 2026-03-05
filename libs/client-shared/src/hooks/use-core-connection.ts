/**
 * React hook for Core WebSocket connection state.
 * Thin wrapper around the connection Zustand store.
 */
import { useStore } from 'zustand';
import { connectionStore, type ConnectionConfig, type ConnectionState } from '../stores/connection-store.js';
import type { CoreInfo, AuthScope } from '@nexus-core/protocol';

export type { ConnectionState, ConnectionConfig as ConnectionOptions };

export interface UseCoreConnectionReturn {
  state: ConnectionState;
  coreInfo: CoreInfo | null;
  sessionId: string | null;
  scopes: AuthScope[];
  error: string | null;
  connect: (config: ConnectionConfig) => void;
  disconnect: () => void;
  send: (message: unknown) => void;
  request: <T = unknown>(namespace: string, action: string, payload: unknown) => Promise<T>;
}

export function useCoreConnection(): UseCoreConnectionReturn {
  const state = useStore(connectionStore, (s) => s.state);
  const coreInfo = useStore(connectionStore, (s) => s.coreInfo);
  const sessionId = useStore(connectionStore, (s) => s.sessionId);
  const scopes = useStore(connectionStore, (s) => s.scopes);
  const error = useStore(connectionStore, (s) => s.error);

  return {
    state,
    coreInfo,
    sessionId,
    scopes,
    error,
    connect: connectionStore.getState().connect,
    disconnect: connectionStore.getState().disconnect,
    send: connectionStore.getState().send,
    request: connectionStore.getState().request,
  };
}
