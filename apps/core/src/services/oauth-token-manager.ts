/**
 * OAuth token lifecycle manager for Claude Plan (Pro/Max) authentication.
 * Handles storage, refresh, browser-based login, and proactive token renewal.
 *
 * OAuth flow:
 * 1. Browser login via claude.ai/oauth/authorize → authorization code
 * 2. Exchange code for access_token + refresh_token
 * 3. Use access_token with `anthropic-beta: oauth-2025-04-20` header
 * 4. Proactively refresh before expiry
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { CoreDatabase } from '../database.js';
import type { HttpRouteHandler } from '../managers/connection-manager.js';

const ANTHROPIC_OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const ANTHROPIC_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CLAUDE_AI_AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const CLAUDEAI_SUCCESS_URL = 'https://platform.claude.com/oauth/code/success?app=claude-code';

/** OAuth scopes matching Claude Code's claude.ai flow. */
const OAUTH_SCOPES = [
  'user:inference',
  'user:profile',
  'user:sessions:claude_code',
  'user:mcp_servers',
];

/** Proactive refresh 5 minutes before expiry. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Browser login timeout (5 minutes). */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
}

export interface OAuthStatus {
  authenticated: boolean;
  method: 'oauth' | 'apikey' | 'none';
  expiresAt?: string;
}

export interface BrowserLoginResult {
  url: string;
  /** Resolves when the user completes the login. */
  completion: Promise<{ success: boolean; message: string }>;
}

export class OAuthTokenManager {
  private db: CoreDatabase;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private registerRoute: ((path: string, handler: HttpRouteHandler) => void) | null = null;
  private callbackPort = 9100;

  /** Called when tokens are refreshed — runtime uses this to reconfigure provider. */
  onTokenRefreshed: ((accessToken: string) => void) | null = null;

  /** Called when browser login completes — runtime uses this to broadcast event. */
  onLoginComplete: ((result: { success: boolean; message: string }) => void) | null = null;

  constructor(db: CoreDatabase) {
    this.db = db;
    this.scheduleRefresh();
  }

  /** Wire the OAuth callback to the Core's HTTP server (same port as WebSocket). */
  setHttpCallback(registerRoute: (path: string, handler: HttpRouteHandler) => void, port: number): void {
    this.registerRoute = registerRoute;
    this.callbackPort = port;
  }

  /** Store new tokens in the database. */
  setTokens(accessToken: string, refreshToken: string, expiresAt: string): void {
    this.db.setSetting('oauth.accessToken', accessToken);
    this.db.setSetting('oauth.refreshToken', refreshToken);
    this.db.setSetting('oauth.expiresAt', expiresAt);
    this.db.setSetting('auth.method', 'oauth');
    this.scheduleRefresh();
  }

  /** Get a current valid access token, refreshing if expired. */
  async getAccessToken(): Promise<string | null> {
    const token = this.db.getSetting('oauth.accessToken') as string | undefined;
    if (!token) return null;

    const expiresAt = this.db.getSetting('oauth.expiresAt') as string | number | undefined;
    if (expiresAt) {
      const expiresMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
      if (expiresMs <= Date.now()) {
        try {
          return await this.refreshAccessToken();
        } catch {
          return null;
        }
      }
    }

    return token;
  }

  /** Refresh the access token using the stored refresh token. */
  async refreshAccessToken(): Promise<string> {
    const refreshToken = this.db.getSetting('oauth.refreshToken') as string | undefined;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(ANTHROPIC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: ANTHROPIC_OAUTH_CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OAuth refresh failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    this.setTokens(data.access_token, data.refresh_token, expiresAt);

    console.log(`[OAuth] Token refreshed, expires at ${expiresAt}`);

    if (this.onTokenRefreshed) {
      this.onTokenRefreshed(data.access_token);
    }

    return data.access_token;
  }

  // ─── Browser-based OAuth Login ──────────────────────────────────────────────

  /**
   * Start a browser-based OAuth login flow.
   * Returns the authorization URL to open in the user's browser and a promise
   * that resolves when the login completes.
   */
  async startBrowserLogin(): Promise<BrowserLoginResult> {
    if (!this.registerRoute) {
      throw new Error('OAuth callback not configured — call setHttpCallback() first');
    }

    // Generate PKCE parameters
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(16).toString('hex');

    // Use tunnel URL for redirect if available (Docker/remote), otherwise localhost
    const port = this.callbackPort;
    const externalUrl = process.env.CONDRIX_CORE_EXTERNAL_URL; // e.g. https://core.example.com from tunnel
    const redirectUri = externalUrl
      ? `${externalUrl.replace(/\/$/, '')}/callback`
      : `http://localhost:${port}/callback`;

    // Construct authorization URL
    const params = new URLSearchParams({
      code: 'true',
      client_id: ANTHROPIC_OAUTH_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: OAUTH_SCOPES.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    const url = `${CLAUDE_AI_AUTHORIZE_URL}?${params.toString()}`;

    // Create a promise that resolves when the callback is received
    const completion = new Promise<{ success: boolean; message: string }>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, message: 'Login timed out (5 minutes). Please try again.' });
      }, LOGIN_TIMEOUT_MS);

      // Register the callback handler on the Core's HTTP server
      this.registerRoute!('/callback', (_req: IncomingMessage, res: ServerResponse) => {
        const reqUrl = new URL(_req.url ?? '/', `http://localhost`);
        const code = reqUrl.searchParams.get('code');
        const reqState = reqUrl.searchParams.get('state');
        const error = reqUrl.searchParams.get('error');

        // Redirect back to the web UI after OAuth completes
        // Priority: Referer header (where user came from) > WEB_PUBLIC_URL env > Anthropic success page
        const referer = _req.headers.referer ?? _req.headers.origin;
        const redirectTo = referer
          ? new URL('/', referer).toString()
          : (process.env.WEB_PUBLIC_URL ?? CLAUDEAI_SUCCESS_URL);

        if (error) {
          const desc = reqUrl.searchParams.get('error_description') ?? error;
          res.writeHead(302, { Location: redirectTo });
          res.end();
          clearTimeout(timeout);
          resolve({ success: false, message: `OAuth error: ${desc}` });
          return;
        }

        if (code && reqState) {
          res.writeHead(302, { Location: redirectTo });
          res.end();
          clearTimeout(timeout);

          if (reqState !== state) {
            resolve({ success: false, message: 'OAuth state mismatch — possible CSRF. Try again.' });
            return;
          }

          this.exchangeCodeForTokens(code, codeVerifier, redirectUri, reqState)
            .then(() => resolve({ success: true, message: 'Successfully signed in with Claude!' }))
            .catch((err) => {
              const msg = err instanceof Error ? err.message : String(err);
              resolve({ success: false, message: `Token exchange failed: ${msg}` });
            });
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing code or state parameter');
          clearTimeout(timeout);
          resolve({ success: false, message: 'Missing authorization code' });
        }
      });
    });

    return { url, completion };
  }

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    state: string,
  ): Promise<void> {
    const response = await fetch(ANTHROPIC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: ANTHROPIC_OAUTH_CLIENT_ID,
        code_verifier: codeVerifier,
        state,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    this.setTokens(data.access_token, data.refresh_token, expiresAt);

    console.log(`[OAuth] Browser login successful, token expires at ${expiresAt}`);

    if (this.onTokenRefreshed) {
      this.onTokenRefreshed(data.access_token);
    }
  }

  // ─── Import from Claude Code ────────────────────────────────────────────────

  /**
   * Import tokens from Claude Code's credential file (~/.claude/.credentials.json).
   */
  async importFromClaudeCode(): Promise<{ success: boolean; message: string }> {
    const credPath = join(homedir(), '.claude', '.credentials.json');
    try {
      const raw = await readFile(credPath, 'utf-8');
      const creds = JSON.parse(raw) as Record<string, unknown>;

      const oauth = creds.claudeAiOauth as
        | { accessToken?: string; refreshToken?: string; expiresAt?: string | number }
        | undefined;

      if (!oauth?.accessToken || !oauth?.refreshToken) {
        return { success: false, message: 'No OAuth tokens found in Claude Code credentials' };
      }

      // expiresAt may be a Unix ms timestamp (number) or ISO string
      let expiresAt: string;
      if (typeof oauth.expiresAt === 'number') {
        expiresAt = new Date(oauth.expiresAt).toISOString();
      } else if (typeof oauth.expiresAt === 'string') {
        expiresAt = oauth.expiresAt;
      } else {
        expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      }

      // Check if token is expired — if so, try refreshing
      if (new Date(expiresAt).getTime() <= Date.now()) {
        console.log('[OAuth] Imported token is expired, attempting refresh...');
        this.db.setSetting('oauth.refreshToken', oauth.refreshToken);
        try {
          await this.refreshAccessToken();
          console.log('[OAuth] Token refreshed after import');
          return { success: true, message: 'OAuth tokens imported and refreshed from Claude Code' };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, message: `Token imported but refresh failed: ${msg}` };
        }
      }

      this.setTokens(oauth.accessToken, oauth.refreshToken, expiresAt);
      console.log('[OAuth] Tokens imported from Claude Code');
      return { success: true, message: 'OAuth tokens imported from Claude Code' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT')) {
        return { success: false, message: 'Claude Code credentials file not found (~/.claude/.credentials.json)' };
      }
      return { success: false, message: `Failed to import: ${msg}` };
    }
  }

  /** Get current OAuth status for UI display. */
  getStatus(): OAuthStatus {
    const authMethod = (this.db.getSetting('auth.method') as string) ?? 'apikey';
    const accessToken = this.db.getSetting('oauth.accessToken') as string | undefined;
    const apiKey = this.db.getSetting('model.apiKey') as string | undefined;
    const expiresAt = this.db.getSetting('oauth.expiresAt') as string | number | undefined;

    if (authMethod === 'oauth' && accessToken) {
      const expiresStr = typeof expiresAt === 'number'
        ? new Date(expiresAt).toISOString()
        : expiresAt;
      return {
        authenticated: true,
        method: 'oauth',
        expiresAt: expiresStr,
      };
    }

    if (apiKey || process.env.ANTHROPIC_API_KEY) {
      return { authenticated: true, method: 'apikey' };
    }

    return { authenticated: false, method: 'none' };
  }

  /** Clean up timers on shutdown. */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const expiresAt = this.db.getSetting('oauth.expiresAt') as string | number | undefined;
    if (!expiresAt) return;

    const expiresMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
    const refreshAt = expiresMs - REFRESH_BUFFER_MS;
    const delay = refreshAt - Date.now();

    if (delay <= 0) {
      // Already past refresh time — refresh immediately (async, non-blocking)
      this.refreshAccessToken().catch((err) => {
        console.error('[OAuth] Proactive refresh failed:', err);
      });
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch((err) => {
        console.error('[OAuth] Scheduled refresh failed:', err);
      });
    }, delay);
  }
}
