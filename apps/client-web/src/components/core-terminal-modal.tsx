/**
 * Modal that opens a root shell on a Core for admin tasks.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { MessageEnvelope } from '@condrix/protocol';
import { multiCoreStore } from '@condrix/client-shared';
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

  useEffect(() => {
    if (!open || terminalId) return;
    multiCoreStore.getState().requestOnCore<{ id: string; title: string }>(
      coreId, 'core', 'terminal.create', { cols: 120, rows: 30 },
    ).then((r) => setTerminalId(r.id))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [open, coreId, terminalId]);

  const handleClose = useCallback(() => {
    if (terminalId) {
      multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'close', { terminalId }).catch(() => {});
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

  const outputListeners = useRef<Map<string, Set<(data: string) => void>>>(new Map());
  useEffect(() => {
    if (!open) return;
    const unsub = multiCoreStore.getState().subscribeOnCore(coreId, 'terminal:output', (event: MessageEnvelope) => {
      const payload = event.payload as { terminalId: string; data: string };
      const listeners = outputListeners.current.get(payload.terminalId);
      if (listeners) { for (const l of listeners) l(payload.data); }
    });
    return unsub;
  }, [coreId, open]);

  const handleOutput = useCallback((tid: string, listener: (data: string) => void) => {
    if (!outputListeners.current.has(tid)) outputListeners.current.set(tid, new Set());
    outputListeners.current.get(tid)!.add(listener);
    return () => { outputListeners.current.get(tid)?.delete(listener); };
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent className="max-w-4xl h-[500px] p-0 gap-0 flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
            <DialogTitle className="text-sm font-medium">Core Terminal — {coreName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {error && <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>}
            {!error && !terminalId && <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Connecting...</div>}
            {terminalId && <TerminalTab terminalId={terminalId} active={true} onData={handleData} onResize={handleResize} onOutput={handleOutput} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
