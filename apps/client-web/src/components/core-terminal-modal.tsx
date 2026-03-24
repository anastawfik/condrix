/**
 * Modal that opens a root shell on a Core for admin tasks
 * like `claude auth login`, `claude auth status`, etc.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { MessageEnvelope } from '@nexus-core/protocol';
import { multiCoreStore } from '@nexus-core/client-shared';
import { TerminalTab } from './terminal/terminal-tab.js';

const URL_REGEX = /https?:\/\/[^\s\x1b\x07]+/g;

interface CoreTerminalModalProps {
  coreId: string;
  coreName: string;
  open: boolean;
  onClose: () => void;
}

export function CoreTerminalModal({ coreId, coreName, open, onClose }: CoreTerminalModalProps) {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Create terminal on open
  useEffect(() => {
    if (!open || terminalId) return;
    setDetectedUrl(null);

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
    setDetectedUrl(null);
    onClose();
  }, [terminalId, coreId, onClose]);

  const handleData = useCallback((tid: string, data: string) => {
    multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'write', { terminalId: tid, data }).catch(() => {});
  }, [coreId]);

  const handleResize = useCallback((tid: string, cols: number, rows: number) => {
    multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'resize', { terminalId: tid, cols, rows }).catch(() => {});
  }, [coreId]);

  // Direct WebSocket subscription for terminal output
  const outputListeners = useRef<Map<string, Set<(data: string) => void>>>(new Map());

  useEffect(() => {
    const unsub = multiCoreStore.getState().subscribeOnCore(coreId, 'terminal:output', (event: MessageEnvelope) => {
      const payload = event.payload as { terminalId: string; data: string };

      // Detect URLs in output (for claude auth login flow)
      if (payload.data) {
        const urls = payload.data.match(URL_REGEX);
        if (urls) {
          // Pick the most relevant URL (prefer claude.ai/oauth or platform.claude.com)
          const authUrl = urls.find(u => u.includes('claude.ai') || u.includes('platform.claude.com')) ?? urls[0];
          if (authUrl) setDetectedUrl(authUrl);
        }
      }

      const listeners = outputListeners.current.get(payload.terminalId);
      if (listeners) {
        for (const listener of listeners) listener(payload.data);
      }
    });
    return unsub;
  }, [coreId]);

  const handleOutput = useCallback((tid: string, listener: (data: string) => void) => {
    if (!outputListeners.current.has(tid)) {
      outputListeners.current.set(tid, new Set());
    }
    outputListeners.current.get(tid)!.add(listener);
    return () => { outputListeners.current.get(tid)?.delete(listener); };
  }, []);

  const handleCopyUrl = useCallback(() => {
    if (detectedUrl) {
      navigator.clipboard.writeText(detectedUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [detectedUrl]);

  return (
    // Re-enable right-click context menu inside the modal (disabled globally on the app)
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent className="max-w-4xl h-[550px] p-0 gap-0 flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-medium">
                Core Terminal — {coreName}
              </DialogTitle>
              <span className="text-xs text-muted-foreground">
                Run <code className="px-1 py-0.5 rounded bg-secondary text-foreground">claude auth login</code> to authenticate
              </span>
            </div>
          </DialogHeader>

          {/* URL detection bar — shows when a URL is detected in terminal output */}
          {detectedUrl && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-border shrink-0">
              <ExternalLink className="size-4 text-primary shrink-0" />
              <span className="text-sm text-foreground truncate flex-1">{detectedUrl}</span>
              <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                <Copy className="size-3.5 mr-1.5" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button size="sm" onClick={() => window.open(detectedUrl, '_blank', 'noopener')}>
                <ExternalLink className="size-3.5 mr-1.5" />
                Open in Browser
              </Button>
            </div>
          )}

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
