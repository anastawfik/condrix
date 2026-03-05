/**
 * Terminal state management.
 * Tracks terminal sessions and their output buffers.
 */
import { createStore } from 'zustand/vanilla';

import { connectionStore } from './connection-store.js';

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
      const conn = connectionStore.getState();
      const result = await conn.request<{ terminalId: string; shell: string }>(
        'terminal', 'create', { workspaceId, shell },
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
      const conn = connectionStore.getState();
      await conn.request('terminal', 'close', { terminalId });
      removeTerminal(set, get, terminalId);
    },

    writeToTerminal: (terminalId, data) => {
      const conn = connectionStore.getState();
      conn.send({
        id: `msg_${Date.now()}`,
        type: 'request',
        namespace: 'terminal',
        action: 'write',
        payload: { terminalId, data },
        timestamp: new Date().toISOString(),
      });
    },

    resizeTerminal: (terminalId, cols, rows) => {
      const conn = connectionStore.getState();
      conn.send({
        id: `msg_${Date.now()}`,
        type: 'request',
        namespace: 'terminal',
        action: 'resize',
        payload: { terminalId, cols, rows },
        timestamp: new Date().toISOString(),
      });
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
