/**
 * Hook for terminal session management.
 * Returns stable function references to avoid unnecessary re-renders.
 */
import { useCallback } from 'react';
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

  const createTerminal = useCallback(
    async (shell?: string) => {
      if (!workspaceId) throw new Error('No workspace selected');
      return terminalStore.getState().createTerminal(workspaceId, shell);
    },
    [workspaceId],
  );

  // These don't depend on workspaceId — use store.getState() for stable refs
  const closeTerminal = useCallback(
    (terminalId: string) => terminalStore.getState().closeTerminal(terminalId),
    [],
  );

  const writeToTerminal = useCallback(
    (terminalId: string, data: string) => terminalStore.getState().writeToTerminal(terminalId, data),
    [],
  );

  const resizeTerminal = useCallback(
    (terminalId: string, cols: number, rows: number) => terminalStore.getState().resizeTerminal(terminalId, cols, rows),
    [],
  );

  const setActiveTerminal = useCallback(
    (terminalId: string | null) => terminalStore.getState().setActiveTerminal(terminalId),
    [],
  );

  const onTerminalOutput = useCallback(
    (terminalId: string, listener: (data: string) => void) => terminalStore.getState().onTerminalOutput(terminalId, listener),
    [],
  );

  return {
    terminals,
    activeTerminalId,
    createTerminal,
    closeTerminal,
    writeToTerminal,
    resizeTerminal,
    setActiveTerminal,
    onTerminalOutput,
  };
}
