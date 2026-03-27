import { useCallback } from 'react';
import { useStore } from 'zustand';
import { workspaceStore, useTerminals } from '@condrix/client-shared';
import { terminalStore } from '@condrix/client-shared';
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
    createTerminal().catch(() => {
      /* ignore */
    });
  }, [createTerminal]);

  const handleData = useCallback(
    (terminalId: string, data: string) => {
      writeToTerminal(terminalId, data);
    },
    [writeToTerminal],
  );

  const handleResize = useCallback(
    (terminalId: string, cols: number, rows: number) => {
      resizeTerminal(terminalId, cols, rows);
    },
    [resizeTerminal],
  );

  const handleOutput = useCallback((terminalId: string, listener: (data: string) => void) => {
    return terminalStore.getState().onTerminalOutput(terminalId, listener);
  }, []);

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-muted-foreground text-sm">
        Select a workspace to use terminal
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <TerminalTabBar
        terminals={terminals}
        activeTerminalId={activeTerminalId}
        onSelect={setActiveTerminal}
        onCreate={handleCreate}
        onClose={(id) => closeTerminal(id).catch(() => {})}
      />

      <div className="flex-1 min-h-0 relative">
        {terminals.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            <button
              onClick={handleCreate}
              className="hover:text-foreground transition-colors duration-100"
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
