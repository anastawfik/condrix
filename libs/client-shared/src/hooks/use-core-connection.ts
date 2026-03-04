import { useState, useEffect, useCallback, useRef } from 'react';
import type { CoreInfo, MessageEnvelope } from '@nexus-core/protocol';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionOptions {
  url: string;
  token: string;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
}

/**
 * React hook for managing a WebSocket connection to a NexusCore Core.
 */
export function useCoreConnection(options: ConnectionOptions) {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [coreInfo, setCoreInfo] = useState<CoreInfo | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    setState('connecting');
    // TODO: Establish WebSocket connection, authenticate, handle state sync
  }, [options.url, options.token]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    setState('disconnected');
  }, []);

  const send = useCallback((message: MessageEnvelope) => {
    wsRef.current?.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { state, coreInfo, connect, disconnect, send };
}
