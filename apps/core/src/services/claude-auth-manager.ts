/**
 * Manages Claude Code CLI authentication on the Core.
 * Monitors token expiry and auto-refreshes before expiration.
 * Emits events when auth state changes so clients can show status icons.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import type { EventEmitter } from 'node:events';

const CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json');
const DEFAULT_REFRESH_BUFFER_MS = 30 * 60 * 1000; // 30 minutes before expiry
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export interface ClaudeAuthState {
  authenticated: boolean;
  method: 'oauth' | 'apikey' | 'none';
  expiresAt?: string;
  claudeInstalled: boolean;
}

export class ClaudeAuthManager {
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private refreshBuffer: number;
  private lastState: ClaudeAuthState | null = null;

  constructor(private emitter: EventEmitter) {
    this.refreshBuffer =
      Number(process.env.CONDRIX_OAUTH_REFRESH_BUFFER_MS) || DEFAULT_REFRESH_BUFFER_MS;
  }

  /** Start monitoring token expiry. */
  start(): void {
    // Check immediately on start
    this.checkAndRefresh();

    // Then check periodically
    this.checkTimer = setInterval(() => {
      this.checkAndRefresh();
    }, CHECK_INTERVAL_MS);
  }

  /** Stop monitoring. */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /** Get current auth state. */
  getState(): ClaudeAuthState {
    return this.readCredentials();
  }

  /** Check if Claude Code CLI is installed. */
  isClaudeInstalled(): boolean {
    try {
      const { execSync } = require('node:child_process');
      execSync('claude --version', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private readCredentials(): ClaudeAuthState {
    const claudeInstalled = existsSync(join(homedir(), '.claude'));

    try {
      if (existsSync(CREDENTIALS_PATH)) {
        const raw = readFileSync(CREDENTIALS_PATH, 'utf-8');
        const creds = JSON.parse(raw);
        const oauth = creds.claudeAiOauth;
        if (oauth?.accessToken && oauth?.refreshToken) {
          const expired = oauth.expiresAt ? oauth.expiresAt < Date.now() : false;
          return {
            authenticated: !expired,
            method: 'oauth',
            expiresAt: oauth.expiresAt ? new Date(oauth.expiresAt).toISOString() : undefined,
            claudeInstalled,
          };
        }
      }
    } catch {
      /* ignore */
    }

    return { authenticated: false, method: 'none', claudeInstalled };
  }

  private checkAndRefresh(): void {
    const state = this.readCredentials();

    // Emit state change events
    if (this.lastState && this.lastState.authenticated !== state.authenticated) {
      if (state.authenticated) {
        console.log('[ClaudeAuth] Tokens are valid');
        this.emitter.emit('core:authRefreshed', state);
      } else {
        console.warn('[ClaudeAuth] Tokens expired or missing');
        this.emitter.emit('core:authExpired', state);
      }
    }
    this.lastState = state;

    if (state.method !== 'oauth' || !state.expiresAt) return;

    const expiresMs = new Date(state.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresMs - now;

    // If within refresh buffer, attempt refresh
    if (timeUntilExpiry < this.refreshBuffer && timeUntilExpiry > 0) {
      console.log(
        `[ClaudeAuth] Token expires in ${Math.round(timeUntilExpiry / 60000)}min, refreshing...`,
      );
      this.refreshToken();
    } else if (timeUntilExpiry <= 0) {
      console.warn('[ClaudeAuth] Token already expired, attempting refresh...');
      this.refreshToken();
    }
  }

  private refreshToken(): void {
    // Use claude CLI to refresh — it handles the OAuth refresh internally
    execFile('claude', ['auth', 'status'], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('[ClaudeAuth] Refresh failed:', stderr || err.message);
        this.emitter.emit('core:authExpired', this.readCredentials());
        return;
      }

      // claude auth status triggers a token refresh if needed
      const newState = this.readCredentials();
      if (newState.authenticated) {
        console.log('[ClaudeAuth] Token refreshed successfully');
        this.emitter.emit('core:authRefreshed', newState);
      } else {
        console.warn('[ClaudeAuth] Token still expired after refresh attempt');
        this.emitter.emit('core:authExpired', newState);
      }
    });
  }

  destroy(): void {
    this.stop();
  }
}
