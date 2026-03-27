/**
 * OAuth token lifecycle manager for Maestro-level Claude Plan authentication.
 * Refactored from Core's OAuthTokenManager — same OAuth flow but stores tokens
 * in Maestro's ai_config table and distributes to all connected Cores.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { MaestroDatabase } from './database.js';
import type { AiConfigDistributor } from './ai-config-distributor.js';

const ANTHROPIC_OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const ANTHROPIC_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CLAUDE_AI_AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const CLAUDEAI_SUCCESS_URL = 'https://platform.claude.com/oauth/code/success?app=claude-code';

const OAUTH_SCOPES = [
  'user:inference',
  'user:profile',
  'user:sessions:claude_code',
  'user:mcp_servers',
];

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface OAuthStatus {
  authenticated: boolean;
  method: 'oauth' | 'apikey' | 'none';
  expiresAt?: string;
}

export class OAuthManager {
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private loginServer: Server | null = null;
  private distributor: AiConfigDistributor | null = null;

  constructor(private db: MaestroDatabase) {
    this.scheduleRefresh();
  }

  setDistributor(distributor: AiConfigDistributor): void {
    this.distributor = distributor;
  }

  /** Store new tokens in the ai_config table. */
  private setTokens(accessToken: string, refreshToken: string, expiresAt: string): void {
    this.db.setAiConfig('oauthAccessToken', accessToken);
    this.db.setAiConfig('oauthRefreshToken', refreshToken);
    this.db.setAiConfig('oauthExpiresAt', expiresAt);
    this.db.setAiConfig('method', 'oauth');
    this.scheduleRefresh();
  }

  /** Refresh the access token using the stored refresh token. */
  async refreshAccessToken(): Promise<{ success: boolean; expiresAt?: string }> {
    const refreshToken = this.db.getAiConfig('oauthRefreshToken');
    if (!refreshToken) {
      return { success: false };
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
    console.log(`[Maestro OAuth] Token refreshed, expires at ${expiresAt}`);

    // Push updated tokens to all Cores
    this.distributor?.pushToAllCores();

    return { success: true, expiresAt };
  }

  /** Start a browser-based OAuth login flow. Returns the authorization URL. */
  async startBrowserLogin(): Promise<{
    url: string;
    completion: Promise<{ success: boolean; message: string }>;
  }> {
    this.cleanupLoginServer();

    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(16).toString('hex');

    // Use a fixed port (Maestro port + 1) so Docker can expose it
    const callbackPort = parseInt(process.env.CONDRIX_MAESTRO_PORT ?? '9200', 10) + 1;
    const { server, port } = await this.startCallbackServer(callbackPort);
    this.loginServer = server;

    const redirectUri = `http://localhost:${port}/callback`;

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

    const completion = new Promise<{ success: boolean; message: string }>((resolve) => {
      const timeout = setTimeout(() => {
        this.cleanupLoginServer();
        resolve({ success: false, message: 'Login timed out (5 minutes). Please try again.' });
      }, LOGIN_TIMEOUT_MS);

      server.once('oauth-callback', async (code: string, callbackState: string) => {
        clearTimeout(timeout);

        if (callbackState !== state) {
          this.cleanupLoginServer();
          resolve({ success: false, message: 'OAuth state mismatch. Try again.' });
          return;
        }

        try {
          await this.exchangeCodeForTokens(code, codeVerifier, redirectUri, callbackState);
          this.cleanupLoginServer();

          // Push to all Cores
          this.distributor?.pushToAllCores();

          resolve({ success: true, message: 'Successfully signed in with Claude!' });
        } catch (err) {
          this.cleanupLoginServer();
          const msg = err instanceof Error ? err.message : String(err);
          resolve({ success: false, message: `Token exchange failed: ${msg}` });
        }
      });

      server.once('oauth-error', (errorMsg: string) => {
        clearTimeout(timeout);
        this.cleanupLoginServer();
        resolve({ success: false, message: errorMsg });
      });
    });

    return { url, completion };
  }

  /** Import tokens from Claude Code's credential file. */
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

      let expiresAt: string;
      if (typeof oauth.expiresAt === 'number') {
        expiresAt = new Date(oauth.expiresAt).toISOString();
      } else if (typeof oauth.expiresAt === 'string') {
        expiresAt = oauth.expiresAt;
      } else {
        expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      }

      // If expired, try refreshing
      if (new Date(expiresAt).getTime() <= Date.now()) {
        this.db.setAiConfig('oauthRefreshToken', oauth.refreshToken);
        try {
          await this.refreshAccessToken();
          return { success: true, message: 'OAuth tokens imported and refreshed from Claude Code' };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, message: `Token imported but refresh failed: ${msg}` };
        }
      }

      this.setTokens(oauth.accessToken, oauth.refreshToken, expiresAt);
      this.distributor?.pushToAllCores();
      return { success: true, message: 'OAuth tokens imported from Claude Code' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT')) {
        return {
          success: false,
          message: 'Claude Code credentials file not found (~/.claude/.credentials.json)',
        };
      }
      return { success: false, message: `Failed to import: ${msg}` };
    }
  }

  /** Get current OAuth status. */
  getStatus(): OAuthStatus {
    const method = this.db.getAiConfig('method') ?? 'none';
    const accessToken = this.db.getAiConfig('oauthAccessToken');
    const apiKey = this.db.getAiConfig('apiKey');
    const expiresAt = this.db.getAiConfig('oauthExpiresAt');

    if (method === 'oauth' && accessToken) {
      return { authenticated: true, method: 'oauth', expiresAt };
    }
    if (method === 'apikey' && apiKey) {
      return { authenticated: true, method: 'apikey' };
    }
    return { authenticated: false, method: 'none' };
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.cleanupLoginServer();
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private startCallbackServer(fixedPort: number): Promise<{ server: Server; port: number }> {
    return new Promise((resolve, reject) => {
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', `http://localhost`);

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const reqState = url.searchParams.get('state');
          const error = url.searchParams.get('error');

          const redirectTo = process.env.WEB_PUBLIC_URL ?? CLAUDEAI_SUCCESS_URL;

          if (error) {
            const desc = url.searchParams.get('error_description') ?? error;
            res.writeHead(302, { Location: redirectTo });
            res.end();
            server.emit('oauth-error', `OAuth error: ${desc}`);
            return;
          }

          if (code && reqState) {
            res.writeHead(302, { Location: redirectTo });
            res.end();
            server.emit('oauth-callback', code, reqState);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing code or state parameter');
            server.emit('oauth-error', 'Missing authorization code');
          }
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      });

      const bindHost = process.env.CONDRIX_MAESTRO_HOST ?? '0.0.0.0';
      server.listen(fixedPort, bindHost, () => {
        console.log(`[Maestro OAuth] Callback server listening on ${bindHost}:${fixedPort}`);
        resolve({ server, port: fixedPort });
      });

      server.on('error', reject);
    });
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
    console.log(`[Maestro OAuth] Browser login successful, token expires at ${expiresAt}`);
  }

  private cleanupLoginServer(): void {
    if (this.loginServer) {
      this.loginServer.close();
      this.loginServer = null;
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const expiresAt = this.db.getAiConfig('oauthExpiresAt');
    if (!expiresAt) return;

    const expiresMs = new Date(expiresAt).getTime();
    const refreshAt = expiresMs - REFRESH_BUFFER_MS;
    const delay = refreshAt - Date.now();

    if (delay <= 0) {
      this.refreshAccessToken().catch((err) => {
        console.error('[Maestro OAuth] Proactive refresh failed:', err);
      });
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch((err) => {
        console.error('[Maestro OAuth] Scheduled refresh failed:', err);
      });
    }, delay);
  }
}
