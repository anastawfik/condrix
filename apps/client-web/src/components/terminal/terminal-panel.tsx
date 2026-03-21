import { useCallback } from 'react';
import { useStore } from 'zustand';
import { Terminal } from 'lucide-react';
import { workspaceStore, useTerminals } from '@nexus-core/client-shared';
import { terminalStore } from '@nexus-core/client-shared';
import { TerminalTabBar } from './terminal-tab-bar.js';
import { TerminalTab } from './terminal-tab.js';

export function TerminalPanel() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const {
    terminals,
    activeTerminalId,
    createTerminal,
    closeTerminal,
    writeToTerminal,
    resizeTerminal,
    setActiveTerminal,
  } = useTerminals(workspaceId);

  const handleCreate = useCallback(() => {
    createTerminal().catch(() => { /* ignore */ });
  }, [createTerminal]);

  const handleData = useCallback((terminalId: string, data: string) => {
    writeToTerminal(terminalId, data);
  }, [writeToTerminal]);

  const handleResize = useCallback((terminalId: string, cols: number, rows: number) => {
    resizeTerminal(terminalId, cols, rows);
  }, [resizeTerminal]);

  const handleOutput = useCallback((terminalId: string, listener: (data: string) => void) => {
    return terminalStore.getState().onTerminalOutput(terminalId, listener);
  }, []);

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full bg-[var(--bg-primary)] text-[var(--text-muted)]">
        <Terminal size={24} />
        <span className="text-sm">Select a workspace to use terminal</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]" data-testid="terminal-panel">
      <TerminalTabBar
        terminals={terminals}
        activeTerminalId={activeTerminalId}
        onSelect={setActiveTerminal}
        onCreate={handleCreate}
        onClose={(id) => closeTerminal(id).catch(() => {})}
      />

      <div className="flex-1 min-h-0 relative">
        {terminals.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
            <Terminal size={24} />
            <button
              onClick={handleCreate}
              className="text-sm hover:text-[var(--text-primary)] transition-colors"
            >
              Click + to create a terminal
            </button>
          </div>
        )}
        {terminals.map((term) => (
          <TerminalTab
            key={term.id}
            terminalId={term.id}
            active={term.id === activeTerminalId}
            onData={handleData}
            onResize={handleResize}
            onOutput={handleOutput}
          />
        ))}
      </div>
    </div>
  );
}
