/**
 * Terminal state management.
 * Tracks terminal sessions and their output buffers.
 */
import { createStore } from 'zustand/vanilla';
import type { MessageEnvelope } from '@nexus-core/protocol';

import { multiCoreStore } from './multi-core-store.js';
import { workspaceStore } from './workspace-store.js';

export interface TerminalSession {
  id: string;
  workspaceId: string;
  title: string;
  active: boolean;
}

export interface TerminalStore {
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  /** Callbacks for terminal output — keyed by terminalId */
  _outputListeners: Map<string, Set<(data: string) => void>>;

  createTerminal: (workspaceId: string, shell?: string) => Promise<TerminalSession>;
  closeTerminal: (terminalId: string) => Promise<void>;
  writeToTerminal: (terminalId: string, data: string) => void;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => void;
  setActiveTerminal: (terminalId: string | null) => void;
  onTerminalOutput: (terminalId: string, listener: (data: string) => void) => () => void;
  handleOutputEvent: (terminalId: string, data: string) => void;
  handleExitEvent: (terminalId: string) => void;
}

export const createTerminalStore = () =>
  createStore<TerminalStore>((set, get) => ({
    terminals: [],
    activeTerminalId: null,
    _outputListeners: new Map(),

    createTerminal: async (workspaceId, shell) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) throw new Error('No active Core connection');
      const result = await multiCoreStore.getState().requestOnCore<{ terminalId: string; shell: string }>(
        coreId, 'terminal', 'create', { workspaceId, shell },
      );

      const session: TerminalSession = {
        id: result.terminalId,
        workspaceId,
        title: result.shell ?? 'Terminal',
        active: true,
      };

      set((s) => ({
        terminals: [...s.terminals, session],
        activeTerminalId: session.id,
      }));

      return session;
    },

    closeTerminal: async (terminalId) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) throw new Error('No active Core connection');
      await multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'close', { terminalId });
      removeTerminal(set, get, terminalId);
    },

    writeToTerminal: (terminalId, data) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      multiCoreStore.getState().sendOnCore(coreId, 'terminal', 'write', { terminalId, data });
    },

    resizeTerminal: (terminalId, cols, rows) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      multiCoreStore.getState().sendOnCore(coreId, 'terminal', 'resize', { terminalId, cols, rows });
    },

    setActiveTerminal: (terminalId) => set({ activeTerminalId: terminalId }),

    onTerminalOutput: (terminalId, listener) => {
      const { _outputListeners } = get();
      if (!_outputListeners.has(terminalId)) {
        _outputListeners.set(terminalId, new Set());
      }
      _outputListeners.get(terminalId)!.add(listener);
      return () => {
        _outputListeners.get(terminalId)?.delete(listener);
      };
    },

    handleOutputEvent: (terminalId, data) => {
      const listeners = get()._outputListeners.get(terminalId);
      if (listeners) {
        for (const listener of listeners) {
          listener(data);
        }
      }
    },

    handleExitEvent: (terminalId) => {
      removeTerminal(set, get, terminalId);
    },
  }));

function removeTerminal(
  set: (fn: (s: TerminalStore) => Partial<TerminalStore>) => void,
  get: () => TerminalStore,
  terminalId: string,
): void {
  set((s) => {
    const terminals = s.terminals.filter((t) => t.id !== terminalId);
    const activeTerminalId = s.activeTerminalId === terminalId
      ? (terminals.length > 0 ? terminals[terminals.length - 1].id : null)
      : s.activeTerminalId;
    return { terminals, activeTerminalId };
  });
  get()._outputListeners.delete(terminalId);
}

export const terminalStore = createTerminalStore();

/**
 * Auto-subscribe to terminal output/exit events whenever a Core connects.
 * Call once at app startup (mirrors initChatSync pattern).
 */
export function initTerminalSync(): () => void {
  const connectedCores = new Set<string>();
  const unsubs = new Map<string, Array<() => void>>();

  const unsub = multiCoreStore.subscribe((state) => {
    // Subscribe to newly connected cores
    for (const [coreId, conn] of state.connections) {
      if (conn.connState === 'connected' && !connectedCores.has(coreId)) {
        connectedCores.add(coreId);

        const coreUnsubs: Array<() => void> = [];

        coreUnsubs.push(
          multiCoreStore.getState().subscribeOnCore(coreId, 'terminal:output', (event: MessageEnvelope) => {
            const payload = event.payload as { terminalId: string; data: string };
            if (payload.terminalId) {
              terminalStore.getState().handleOutputEvent(payload.terminalId, payload.data);
            }
          }),
        );

        coreUnsubs.push(
          multiCoreStore.getState().subscribeOnCore(coreId, 'terminal:exit', (event: MessageEnvelope) => {
            const payload = event.payload as { terminalId: string };
            if (payload.terminalId) {
              terminalStore.getState().handleExitEvent(payload.terminalId);
            }
          }),
        );

        unsubs.set(coreId, coreUnsubs);
      }
    }

    // Unsubscribe from disconnected cores
    for (const coreId of connectedCores) {
      if (!state.connections.has(coreId)) {
        connectedCores.delete(coreId);
        const coreUnsubs = unsubs.get(coreId);
        if (coreUnsubs) {
          for (const u of coreUnsubs) u();
          unsubs.delete(coreId);
        }
      }
    }
  });

  return unsub;
}
