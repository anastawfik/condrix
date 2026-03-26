/**
 * Modal for Core OAuth sign-in flow.
 * Step 1: Start auth → Step 2: Paste code → Step 3: Done
 */
import { useState, useEffect } from 'react';
import { ExternalLink, LogIn, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { multiCoreStore } from '@condrix/client-shared';
import type { MessageEnvelope } from '@condrix/protocol';

interface CoreSignInModalProps {
  coreId: string;
  coreName: string;
  open: boolean;
  onClose: () => void;
}

type AuthStep = 'idle' | 'starting' | 'waiting-for-code' | 'submitting' | 'success' | 'error';

export function CoreSignInModal({ coreId, coreName, open, onClose }: CoreSignInModalProps) {
  const [authStep, setAuthStep] = useState<AuthStep>('idle');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    if (open) {
      setAuthStep('idle');
      setAuthUrl(null);
      setAuthCode('');
      setAuthMessage('');
    }
  }, [open]);

  // Listen for auth completing automatically (native mode — CLI handles callback itself)
  useEffect(() => {
    if (!open || authStep === 'idle' || authStep === 'success') return;
    const unsub = multiCoreStore.getState().subscribeOnCore(coreId, 'core:authLoginComplete', (event) => {
      const payload = event.payload as { success: boolean; message: string };
      if (payload.success) {
        setAuthStep('success');
        setAuthMessage('Authentication successful! You can now use all Claude models.');
      }
    });
    return unsub;
  }, [open, coreId, authStep]);

  const startLogin = async () => {
    setAuthStep('starting');
    setAuthMessage('');
    try {
      const result = await multiCoreStore.getState().requestOnCore<{ url: string }>(
        coreId, 'core', 'auth.login', {},
      );
      setAuthUrl(result.url);
      setAuthStep('waiting-for-code');
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
      await multiCoreStore.getState().requestOnCore<{ submitted: boolean; message: string }>(
        coreId, 'core', 'auth.submitCode', { code: authCode.trim() },
      );
      setAuthStep('success');
      setAuthMessage('Authentication successful! You can now use all Claude models.');
    } catch (err) {
      setAuthStep('error');
      setAuthMessage(err instanceof Error ? err.message : 'Failed to submit code');
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Sign in with Claude — {coreName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {authStep === 'idle' && (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                  <LogIn className="size-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Authenticate this Core with your Claude Plan.
                </p>
                <Button onClick={startLogin}>
                  <LogIn className="size-4 mr-2" /> Start Authentication
                </Button>
              </div>
            )}

            {authStep === 'starting' && (
              <div className="text-center space-y-3 py-4">
                <Loader2 className="size-8 mx-auto text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Starting authentication...</p>
              </div>
            )}

            {authStep === 'waiting-for-code' && (
              <div className="space-y-4">
                <div className="text-center">
                  <CheckCircle className="size-6 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">Complete sign-in in your browser</p>
                  <p className="text-sm text-muted-foreground mt-1">Then paste the code below:</p>
                </div>

                {authUrl && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-md text-xs">
                    <span className="truncate flex-1 text-muted-foreground">{authUrl}</span>
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
                    placeholder="Paste auth code here..."
                    className="flex-1 font-mono text-sm"
                    autoFocus
                  />
                  <Button onClick={submitCode} disabled={!authCode.trim()}>Submit</Button>
                </div>
              </div>
            )}

            {authStep === 'submitting' && (
              <div className="text-center space-y-3 py-4">
                <Loader2 className="size-8 mx-auto text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Authenticating...</p>
              </div>
            )}

            {authStep === 'success' && (
              <div className="text-center space-y-4">
                <CheckCircle className="size-10 mx-auto text-green-500" />
                <p className="text-sm text-muted-foreground">{authMessage}</p>
                <Button variant="secondary" onClick={onClose}>Done</Button>
              </div>
            )}

            {authStep === 'error' && (
              <div className="text-center space-y-4">
                <p className="text-sm text-destructive">{authMessage}</p>
                <Button variant="secondary" onClick={() => setAuthStep('idle')}>Try Again</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
