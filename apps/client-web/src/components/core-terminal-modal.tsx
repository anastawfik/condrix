/**
 * Modal that opens a root shell on a Core for admin tasks
 * like `claude auth login`, `claude auth status`, etc.
 */
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { multiCoreStore, terminalStore } from '@nexus-core/client-shared';
import { TerminalTab } from './terminal/terminal-tab.js';

interface CoreTerminalModalProps {
  coreId: string;
  coreName: string;
  open: boolean;
  onClose: () => void;
}

export function CoreTerminalModal({ coreId, coreName, open, onClose }: CoreTerminalModalProps) {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create terminal on open
  useEffect(() => {
    if (!open || terminalId) return;

    multiCoreStore.getState().requestOnCore<{ id: string; title: string }>(
      coreId, 'core', 'terminal.create', { cols: 120, rows: 30 },
    ).then((result) => {
      setTerminalId(result.id);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to create terminal');
    });
  }, [open, coreId, terminalId]);

  // Cleanup on close
  const handleClose = useCallback(() => {
    if (terminalId) {
      multiCoreStore.getState().requestOnCore(
        coreId, 'terminal', 'close', { terminalId },
      ).catch(() => {});
      setTerminalId(null);
    }
    setError(null);
    onClose();
  }, [terminalId, coreId, onClose]);

  const handleData = useCallback((tid: string, data: string) => {
    multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'write', { terminalId: tid, data }).catch(() => {});
  }, [coreId]);

  const handleResize = useCallback((tid: string, cols: number, rows: number) => {
    multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'resize', { terminalId: tid, cols, rows }).catch(() => {});
  }, [coreId]);

  const handleOutput = useCallback((tid: string, listener: (data: string) => void) => {
    return terminalStore.getState().onTerminalOutput(tid, listener);
  }, []);

  return (
    // Stop click propagation so clicking inside the modal doesn't close the settings dialog behind it
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent className="max-w-4xl h-[500px] p-0 gap-0 flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
            <DialogTitle className="text-sm font-medium">
              Core Terminal — {coreName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {error && (
              <div className="flex items-center justify-center h-full text-destructive text-sm">
                {error}
              </div>
            )}
            {!error && !terminalId && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Connecting...
              </div>
            )}
            {terminalId && (
              <TerminalTab
                terminalId={terminalId}
                active={true}
                onData={handleData}
                onResize={handleResize}
                onOutput={handleOutput}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
