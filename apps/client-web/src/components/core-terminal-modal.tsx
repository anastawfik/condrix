/**
 * Modal for Core authentication and admin tasks.
 * Two tabs: OAuth sign-in flow + raw terminal.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, Copy, Upload, KeyRound, Terminal, LogIn, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type Tab = 'signin' | 'terminal';
type AuthStep = 'idle' | 'starting' | 'waiting-for-code' | 'submitting' | 'success' | 'error';

export function CoreTerminalModal({ coreId, coreName, open, onClose }: CoreTerminalModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('signin');

  // OAuth flow state
  const [authStep, setAuthStep] = useState<AuthStep>('idle');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Terminal state
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setAuthStep('idle');
      setAuthUrl(null);
      setAuthCode('');
      setAuthMessage('');
    }
  }, [open]);

  // Create terminal only when terminal tab is active
  useEffect(() => {
    if (!open || activeTab !== 'terminal' || terminalId) return;
    multiCoreStore.getState().requestOnCore<{ id: string; title: string }>(
      coreId, 'core', 'terminal.create', { cols: 120, rows: 30 },
    ).then((result) => setTerminalId(result.id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed'));
  }, [open, coreId, terminalId, activeTab]);

  const handleClose = useCallback(() => {
    if (terminalId) {
      multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'close', { terminalId }).catch(() => {});
      setTerminalId(null);
    }
    setError(null);
    onClose();
  }, [terminalId, coreId, onClose]);

  // ─── OAuth Flow ─────────────────────────────────────────────────────────

  const startLogin = async () => {
    setAuthStep('starting');
    setAuthMessage('');
    try {
      const result = await multiCoreStore.getState().requestOnCore<{ url: string }>(
        coreId, 'core', 'auth.login', {},
      );
      setAuthUrl(result.url);
      setAuthStep('waiting-for-code');
      // Auto-open in browser
      window.open(result.url, '_blank', 'noopener');
    } catch (err) {
      setAuthStep('error');
      setAuthMessage(err instanceof Error ? err.message : 'Failed to start login');
    }
  };

  const submitCode = async () => {
    if (!authCode.trim()) return;
    setAuthStep('submitting');
    try {
      const result = await multiCoreStore.getState().requestOnCore<{ submitted: boolean; message: string }>(
        coreId, 'core', 'auth.submitCode', { code: authCode.trim() },
      );
      if (result.submitted) {
        setAuthStep('success');
        setAuthMessage('Authentication successful! You can now use all Claude models.');
      } else {
        setAuthStep('error');
        setAuthMessage(result.message);
      }
    } catch (err) {
      setAuthStep('error');
      setAuthMessage(err instanceof Error ? err.message : 'Failed to submit code');
    }
  };

  // ─── Terminal output subscription ─────────────────────────────────────

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

  const handleData = useCallback((tid: string, data: string) => {
    multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'write', { terminalId: tid, data }).catch(() => {});
  }, [coreId]);
  const handleResize = useCallback((tid: string, cols: number, rows: number) => {
    multiCoreStore.getState().requestOnCore(coreId, 'terminal', 'resize', { terminalId: tid, cols, rows }).catch(() => {});
  }, [coreId]);
  const handleOutput = useCallback((tid: string, listener: (data: string) => void) => {
    if (!outputListeners.current.has(tid)) outputListeners.current.set(tid, new Set());
    outputListeners.current.get(tid)!.add(listener);
    return () => { outputListeners.current.get(tid)?.delete(listener); };
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent className="max-w-2xl p-0 gap-0 flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-medium">
                Authenticate — {coreName}
              </DialogTitle>
              <div className="flex gap-1">
                <Button size="sm" variant={activeTab === 'signin' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('signin')}>
                  <LogIn className="size-3.5 mr-1.5" /> Sign In
                </Button>
                <Button size="sm" variant={activeTab === 'terminal' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('terminal')}>
                  <Terminal className="size-3.5 mr-1.5" /> Terminal
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Sign In tab */}
          {activeTab === 'signin' && (
            <div className="p-6 space-y-5">
              {/* Step 1: Start */}
              {authStep === 'idle' && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                    <LogIn className="size-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-foreground">Sign in with Claude</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Authenticate this Core with your Claude Plan subscription.
                    </p>
                  </div>
                  <Button size="lg" onClick={startLogin}>
                    <LogIn className="size-4 mr-2" /> Start Authentication
                  </Button>
                </div>
              )}

              {/* Step 1b: Starting... */}
              {authStep === 'starting' && (
                <div className="text-center space-y-3">
                  <Loader2 className="size-8 mx-auto text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Starting authentication...</p>
                </div>
              )}

              {/* Step 2: Paste code */}
              {authStep === 'waiting-for-code' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <CheckCircle className="size-6 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-foreground font-medium">Browser opened! Complete sign-in there.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      After authenticating, you'll see a code. Paste it below:
                    </p>
                  </div>

                  {authUrl && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-md">
                      <span className="text-xs text-muted-foreground truncate flex-1">{authUrl}</span>
                      <Button size="sm" variant="ghost" onClick={() => window.open(authUrl, '_blank', 'noopener')}>
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitCode(); }}
                      placeholder="Paste the auth code here..."
                      className="flex-1 font-mono"
                      autoFocus
                    />
                    <Button onClick={submitCode} disabled={!authCode.trim()}>
                      Submit
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Submitting */}
              {authStep === 'submitting' && (
                <div className="text-center space-y-3">
                  <Loader2 className="size-8 mx-auto text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Authenticating...</p>
                </div>
              )}

              {/* Step 4: Success */}
              {authStep === 'success' && (
                <div className="text-center space-y-4">
                  <CheckCircle className="size-12 mx-auto text-green-500" />
                  <div>
                    <h3 className="text-base font-medium text-foreground">Authenticated!</h3>
                    <p className="text-sm text-muted-foreground mt-1">{authMessage}</p>
                  </div>
                  <Button variant="secondary" onClick={handleClose}>Done</Button>
                </div>
              )}

              {/* Error */}
              {authStep === 'error' && (
                <div className="text-center space-y-4">
                  <div className="text-destructive text-sm">{authMessage}</div>
                  <Button variant="secondary" onClick={() => setAuthStep('idle')}>Try Again</Button>
                </div>
              )}
            </div>
          )}

          {/* Terminal tab */}
          {activeTab === 'terminal' && (
            <div className="h-[400px] min-h-0">
              {error && <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>}
              {!error && !terminalId && <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Connecting...</div>}
              {terminalId && <TerminalTab terminalId={terminalId} active={true} onData={handleData} onResize={handleResize} onOutput={handleOutput} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
