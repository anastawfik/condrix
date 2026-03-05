/**
 * Hook for terminal session management.
 */
import { useStore } from 'zustand';
import { terminalStore, type TerminalSession } from '../stores/terminal-store.js';

export interface UseTerminalsReturn {
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  createTerminal: (shell?: string) => Promise<TerminalSession>;
  closeTerminal: (terminalId: string) => Promise<void>;
  writeToTerminal: (terminalId: string, data: string) => void;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => void;
  setActiveTerminal: (terminalId: string | null) => void;
  onTerminalOutput: (terminalId: string, listener: (data: string) => void) => () => void;
}

export function useTerminals(workspaceId: string | null): UseTerminalsReturn {
  const terminals = useStore(terminalStore, (s) => s.terminals);
  const activeTerminalId = useStore(terminalStore, (s) => s.activeTerminalId);

  return {
    terminals,
    activeTerminalId,
    createTerminal: async (shell?: string) => {
      if (!workspaceId) throw new Error('No workspace selected');
      return terminalStore.getState().createTerminal(workspaceId, shell);
    },
    closeTerminal: (terminalId: string) => terminalStore.getState().closeTerminal(terminalId),
    writeToTerminal: (terminalId: string, data: string) => terminalStore.getState().writeToTerminal(terminalId, data),
    resizeTerminal: (terminalId: string, cols: number, rows: number) => terminalStore.getState().resizeTerminal(terminalId, cols, rows),
    setActiveTerminal: (terminalId: string | null) => terminalStore.getState().setActiveTerminal(terminalId),
    onTerminalOutput: (terminalId: string, listener: (data: string) => void) => terminalStore.getState().onTerminalOutput(terminalId, listener),
  };
}
