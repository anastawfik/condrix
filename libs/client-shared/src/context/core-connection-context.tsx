/**
 * React context provider for Core WebSocket connection.
 * Wraps connection store and provides event subscriptions for child components.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { connectionStore, type ConnectionStore, type ConnectionConfig } from '../stores/connection-store.js';
import { chatStore } from '../stores/chat-store.js';
import { terminalStore } from '../stores/terminal-store.js';
import type { MessageEnvelope } from '@nexus-core/protocol';

const CoreConnectionContext = createContext<typeof connectionStore | null>(null);

export interface CoreConnectionProviderProps {
  children: ReactNode;
}

export function CoreConnectionProvider({ children }: CoreConnectionProviderProps) {
  const subscriptionsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    // Subscribe to agent events
    const unsubAgent = connectionStore.getState().subscribe('agent:*', (event: MessageEnvelope) => {
      const workspaceId = (event as unknown as { workspaceId?: string }).workspaceId;
      if (workspaceId) {
        chatStore.getState()._handleAgentEvent(workspaceId, event);
      }
    });
    subscriptionsRef.current.push(unsubAgent);

    // Subscribe to terminal events
    const unsubTermOutput = connectionStore.getState().subscribe('terminal:output', (event: MessageEnvelope) => {
      const payload = event.payload as { terminalId: string; data: string };
      if (payload.terminalId) {
        terminalStore.getState().handleOutputEvent(payload.terminalId, payload.data);
      }
    });
    subscriptionsRef.current.push(unsubTermOutput);

    const unsubTermExit = connectionStore.getState().subscribe('terminal:exit', (event: MessageEnvelope) => {
      const payload = event.payload as { terminalId: string };
      if (payload.terminalId) {
        terminalStore.getState().handleExitEvent(payload.terminalId);
      }
    });
    subscriptionsRef.current.push(unsubTermExit);

    return () => {
      for (const unsub of subscriptionsRef.current) {
        unsub();
      }
      subscriptionsRef.current = [];
    };
  }, []);

  return (
    <CoreConnectionContext.Provider value={connectionStore}>
      {children}
    </CoreConnectionContext.Provider>
  );
}

/** Hook to select state from the connection store */
export function useConnection<T>(selector: (state: ConnectionStore) => T): T {
  const store = useContext(CoreConnectionContext);
  if (!store) throw new Error('useConnection must be used within CoreConnectionProvider');
  return useStore(store, selector);
}

/** Hook to get connection actions */
export function useConnectionActions() {
  return {
    connect: (config: ConnectionConfig) => connectionStore.getState().connect(config),
    disconnect: () => connectionStore.getState().disconnect(),
  };
}
