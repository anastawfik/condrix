/**
 * Modal that opens a root shell on a Core for admin tasks
 * and provides credential import for OAuth authentication.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, Copy, Upload, KeyRound, Terminal } from 'lucide-react';
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

type Tab = 'terminal' | 'import';

export function CoreTerminalModal({ coreId, coreName, open, onClose }: CoreTerminalModalProps) {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('import');
  const [credInput, setCredInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);

  // Create terminal on open (only when terminal tab is active)
  useEffect(() => {
    if (!open || activeTab !== 'terminal' || terminalId) return;

    multiCoreStore.getState().requestOnCore<{ id: string; title: string }>(
      coreId, 'core', 'terminal.create', { cols: 120, rows: 30 },
    ).then((result) => {
      setTerminalId(result.id);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to create terminal');
    });
  }, [open, coreId, terminalId, activeTab]);

  const handleClose = useCallback(() => {
    if (terminalId) {
      multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'close', { terminalId }).catch(() => {});
      setTerminalId(null);
    }
    setError(null);
    setDetectedUrl(null);
    setCredInput('');
    setImportStatus(null);
    setActiveTab('import');
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
      if (payload.data) {
        const urls = payload.data.match(URL_REGEX);
        if (urls) {
          const authUrl = urls.find(u => u.includes('claude.ai') || u.includes('platform.claude.com')) ?? urls[0];
          if (authUrl) setDetectedUrl(authUrl);
        }
      }
      const listeners = outputListeners.current.get(payload.terminalId);
      if (listeners) { for (const listener of listeners) listener(payload.data); }
    });
    return unsub;
  }, [coreId, open]);

  const handleOutput = useCallback((tid: string, listener: (data: string) => void) => {
    if (!outputListeners.current.has(tid)) outputListeners.current.set(tid, new Set());
    outputListeners.current.get(tid)!.add(listener);
    return () => { outputListeners.current.get(tid)?.delete(listener); };
  }, []);

  const handleImport = async () => {
    setImporting(true);
    setImportStatus(null);
    try {
      let creds;
      try {
        const parsed = JSON.parse(credInput.trim());
        // Accept either full credentials.json or just the claudeAiOauth object
        creds = parsed.claudeAiOauth ?? parsed;
      } catch {
        setImportStatus({ type: 'error', message: 'Invalid JSON. Paste the contents of ~/.claude/.credentials.json' });
        return;
      }

      if (!creds.accessToken || !creds.refreshToken) {
        setImportStatus({ type: 'error', message: 'Missing accessToken or refreshToken in the pasted JSON' });
        return;
      }

      const result = await multiCoreStore.getState().requestOnCore<{ success: boolean; expiresAt?: string }>(
        coreId, 'core', 'auth.import', { credentials: creds },
      );

      if (result.success) {
        setImportStatus({ type: 'success', message: `Credentials imported! Expires: ${result.expiresAt ?? 'unknown'}` });
        setCredInput('');
      }
    } catch (err) {
      setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent className="max-w-4xl h-[550px] p-0 gap-0 flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-medium">
                Core Authentication — {coreName}
              </DialogTitle>
              <div className="flex gap-1">
                <Button size="sm" variant={activeTab === 'import' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('import')}>
                  <KeyRound className="size-3.5 mr-1.5" /> Import Token
                </Button>
                <Button size="sm" variant={activeTab === 'terminal' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('terminal')}>
                  <Terminal className="size-3.5 mr-1.5" /> Terminal
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Import Token tab */}
          {activeTab === 'import' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Import Claude Credentials</h3>
                <p className="text-sm text-muted-foreground">
                  On the machine where Claude Code is authenticated, run:
                </p>
                <pre className="px-3 py-2 rounded-md bg-secondary text-sm font-mono text-foreground overflow-x-auto">
                  cat ~/.claude/.credentials.json
                </pre>
                <p className="text-sm text-muted-foreground">
                  Copy the output and paste it below:
                </p>
              </div>
              <textarea
                value={credInput}
                onChange={(e) => setCredInput(e.target.value)}
                placeholder='{"claudeAiOauth":{"accessToken":"sk-ant-oat01-...","refreshToken":"sk-ant-ort01-...","expiresAt":1234567890}}'
                className="w-full h-32 px-3 py-2 rounded-md bg-background border border-border text-sm font-mono text-foreground resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {importStatus && (
                <div className={`text-sm px-3 py-2 rounded-md ${importStatus.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                  {importStatus.message}
                </div>
              )}
              <Button onClick={handleImport} disabled={!credInput.trim() || importing}>
                <Upload className="size-4 mr-2" />
                {importing ? 'Importing...' : 'Import Credentials'}
              </Button>
            </div>
          )}

          {/* Terminal tab */}
          {activeTab === 'terminal' && (
            <>
              {detectedUrl && (
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-border shrink-0">
                  <ExternalLink className="size-4 text-primary shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{detectedUrl}</span>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(detectedUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    <Copy className="size-3.5 mr-1.5" />{copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button size="sm" onClick={() => window.open(detectedUrl, '_blank', 'noopener')}>
                    <ExternalLink className="size-3.5 mr-1.5" />Open in Browser
                  </Button>
                </div>
              )}
              <div className="flex-1 min-h-0">
                {error && <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>}
                {!error && !terminalId && <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Connecting...</div>}
                {terminalId && (
                  <TerminalTab terminalId={terminalId} active={true} onData={handleData} onResize={handleResize} onOutput={handleOutput} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
