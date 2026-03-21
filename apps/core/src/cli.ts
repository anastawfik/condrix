#!/usr/bin/env node

/**
 * NexusCore CLI entry point.
 *
 * Usage: nexus-core [options]
 *
 * Options:
 *   --port <port>           WebSocket port (default: 9100, env: NEXUS_CORE_PORT)
 *   --host <host>           Bind host (default: 127.0.0.1, env: NEXUS_CORE_HOST)
 *   --name <name>           Display name (default: NexusCore, env: NEXUS_CORE_NAME)
 *   --api-key <key>         Anthropic API key (env: ANTHROPIC_API_KEY)
 *   --model <model>         Claude model ID (env: NEXUS_CLAUDE_MODEL)
 *   --max-tokens <n>        Max output tokens (env: NEXUS_CLAUDE_MAX_TOKENS)
 *   --tunnel                Enable quick tunnel on startup (env: NEXUS_TUNNEL_ENABLED=true)
 *   --tunnel-mode <mode>    Tunnel mode: quick or named (env: NEXUS_TUNNEL_MODE)
 *   --tunnel-token <token>  Cloudflare tunnel token (env: NEXUS_TUNNEL_TOKEN)
 *   --production            Disable dev mode (require auth tokens)
 *   --db-path <path>        Database file path (env: NEXUS_CORE_DB_PATH)
 *
 * Commands:
 *   --oauth-login           Authenticate via OAuth (prints URL for headless)
 *   --generate-token [name] Generate an auth token for remote clients
 *   --list-tokens           List existing auth tokens
 *   --help                  Show this help message
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';

import { CoreRuntime, type CoreConfig } from './runtime.js';
import { CoreDatabase } from './database.js';
import { AuthManager } from './auth.js';
import { OAuthTokenManager } from './services/oauth-token-manager.js';
import { logger } from './logger.js';

// ─── Arg Parsing ────────────────────────────────────────────────────────────

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const next = process.argv[idx + 1];
  return next && !next.startsWith('--') ? next : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function initDbDir(): string {
  const dbDir = join(homedir(), '.nexuscore');
  mkdirSync(dbDir, { recursive: true });
  return dbDir;
}

function getDbPath(): string {
  const dbDir = initDbDir();
  return getArg('db-path') ?? process.env.NEXUS_CORE_DB_PATH ?? join(dbDir, 'core.db');
}

// ─── Help ───────────────────────────────────────────────────────────────────

if (hasFlag('help') || hasFlag('h')) {
  console.log(`
NexusCore — Distributed AI Agent Runtime

Usage: nexus-core [options]

Server Options:
  --port <port>           WebSocket port (default: 9100, env: NEXUS_CORE_PORT)
  --host <host>           Bind host (default: 127.0.0.1, env: NEXUS_CORE_HOST)
  --name <name>           Display name (default: NexusCore, env: NEXUS_CORE_NAME)
  --production            Disable dev mode (require auth tokens)
  --db-path <path>        Database file path (env: NEXUS_CORE_DB_PATH)

AI Configuration:
  --api-key <key>         Anthropic API key (env: ANTHROPIC_API_KEY)
  --model <model>         Claude model ID (env: NEXUS_CLAUDE_MODEL)
  --max-tokens <n>        Max output tokens (env: NEXUS_CLAUDE_MAX_TOKENS)

Tunnel (Cloudflare):
  --tunnel                Enable quick tunnel on startup (env: NEXUS_TUNNEL_ENABLED=true)
  --tunnel-mode <mode>    Tunnel mode: quick or named (env: NEXUS_TUNNEL_MODE)
  --tunnel-token <token>  Cloudflare tunnel token (env: NEXUS_TUNNEL_TOKEN)

Commands:
  --oauth-login           Authenticate with your Claude Plan (opens browser / prints URL)
  --generate-token [name] Generate an auth token for remote clients
  --list-tokens           List existing auth tokens
  --help                  Show this help message

Examples:
  nexus-core --api-key sk-ant-xxx                    # Start with API key
  nexus-core --tunnel                                # Start with quick tunnel
  nexus-core --api-key sk-ant-xxx --tunnel            # API key + tunnel
  nexus-core --oauth-login                           # Authenticate via OAuth, then start
  nexus-core --tunnel-token eyJxxx --production      # Named tunnel in production mode

Environment Variables:
  ANTHROPIC_API_KEY        Anthropic API key
  NEXUS_CORE_PORT          WebSocket port
  NEXUS_CORE_HOST          Bind host
  NEXUS_CORE_NAME          Display name
  NEXUS_CORE_ID            Core identifier
  NEXUS_CORE_DB_PATH       Database file path
  NEXUS_CORE_DEV_MODE      Set to "false" for production
  NEXUS_CLAUDE_MODEL       Default Claude model
  NEXUS_CLAUDE_MAX_TOKENS  Max output tokens
  NEXUS_TUNNEL_ENABLED     Set to "true" to auto-start tunnel
  NEXUS_TUNNEL_MODE        Tunnel mode (quick or named)
  NEXUS_TUNNEL_TOKEN       Cloudflare tunnel token
`);
  process.exit(0);
}

// ─── Generate Token Command ─────────────────────────────────────────────────

if (hasFlag('generate-token')) {
  const name = getArg('generate-token') ?? 'cli-generated';
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  const authManager = new AuthManager(db);
  const token = authManager.generateToken(name);
  console.log(`Token generated:\n  Name:  ${token.name}\n  Token: ${token.token}`);
  db.close();
  process.exit(0);
}

// ─── List Tokens Command ────────────────────────────────────────────────────

if (hasFlag('list-tokens')) {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  const authManager = new AuthManager(db);
  const tokens = authManager.listTokens();
  if (tokens.length === 0) {
    console.log('No tokens found.');
  } else {
    console.log('Auth tokens:');
    for (const t of tokens) {
      console.log(`  ${t.name}: ${t.token.slice(0, 12)}... (created: ${t.createdAt})`);
    }
  }
  db.close();
  process.exit(0);
}

// ─── OAuth Login Command ────────────────────────────────────────────────────

if (hasFlag('oauth-login')) {
  (async () => {
    const dbPath = getDbPath();
    const db = new CoreDatabase({ path: dbPath });
    const oauthManager = new OAuthTokenManager(db);

    console.log('[Core] Starting OAuth login...\n');

    try {
      const { url, completion } = await oauthManager.startBrowserLogin();

      console.log('Open this URL in your browser to sign in:\n');
      console.log(`  ${url}\n`);
      console.log('Waiting for authentication callback...\n');

      // Try to open browser (best-effort)
      try {
        const { exec } = await import('node:child_process');
        const openCmd =
          process.platform === 'win32' ? `start "" "${url}"` :
          process.platform === 'darwin' ? `open "${url}"` :
          `xdg-open "${url}"`;
        exec(openCmd);
      } catch {
        // Browser open failed — URL is printed above for manual use
      }

      const result = await completion;

      if (result.success) {
        db.setSetting('auth.method', 'oauth');
        console.log('Authentication successful!');
        console.log('OAuth tokens saved. The Core will use your Claude Plan on next start.');
      } else {
        console.error(`Authentication failed: ${result.message}`);
      }

      oauthManager.destroy();
      db.close();

      // If --oauth-login is the only command, exit. Otherwise continue to start server.
      if (!hasFlag('tunnel') && !getArg('api-key') && !getArg('port')) {
        process.exit(result.success ? 0 : 1);
      }
    } catch (err) {
      console.error(`OAuth login error: ${(err as Error).message}`);
      oauthManager.destroy();
      db.close();
      process.exit(1);
    }
  })().catch((err) => {
    console.error('[Core] OAuth login failed:', err);
    process.exit(1);
  });
} else {
  // ─── Normal Startup ─────────────────────────────────────────────────────────
  startServer();
}

// ─── Global Error Handlers ─────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  logger.fatal('[Core]', 'Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal('[Core]', 'Unhandled rejection:', reason);
  process.exit(1);
});

function startServer(): void {
  // Build config from CLI args + env vars
  const config: CoreConfig = {
    coreId: getArg('core-id') ?? process.env.NEXUS_CORE_ID ?? 'core-default',
    displayName: getArg('name') ?? process.env.NEXUS_CORE_NAME ?? 'NexusCore',
    host: getArg('host') ?? process.env.NEXUS_CORE_HOST ?? '127.0.0.1',
    port: Number(getArg('port') ?? process.env.NEXUS_CORE_PORT ?? 9100),
    dbPath: getArg('db-path') ?? process.env.NEXUS_CORE_DB_PATH ?? undefined,
    devMode: !hasFlag('production') && process.env.NEXUS_CORE_DEV_MODE !== 'false',
  };

  // Collect initial settings from CLI args and env vars
  const apiKey = getArg('api-key') ?? process.env.ANTHROPIC_API_KEY;
  const model = getArg('model') ?? process.env.NEXUS_CLAUDE_MODEL;
  const maxTokensStr = getArg('max-tokens') ?? process.env.NEXUS_CLAUDE_MAX_TOKENS;
  const tunnelEnabled = hasFlag('tunnel') || process.env.NEXUS_TUNNEL_ENABLED === 'true';
  const tunnelMode = (getArg('tunnel-mode') ?? process.env.NEXUS_TUNNEL_MODE) as 'quick' | 'named' | undefined;
  const tunnelToken = getArg('tunnel-token') ?? process.env.NEXUS_TUNNEL_TOKEN;

  // Only include settings that were explicitly provided
  const initialSettings: CoreConfig['initialSettings'] = {};
  if (apiKey) initialSettings.apiKey = apiKey;
  if (model) initialSettings.model = model;
  if (maxTokensStr) initialSettings.maxTokens = Number(maxTokensStr);
  if (tunnelEnabled) initialSettings.tunnelEnabled = true;
  if (tunnelMode) initialSettings.tunnelMode = tunnelMode;
  if (tunnelToken) {
    initialSettings.tunnelToken = tunnelToken;
    initialSettings.tunnelMode = initialSettings.tunnelMode ?? 'named';
    initialSettings.tunnelEnabled = true;
  }

  if (Object.keys(initialSettings).length > 0) {
    config.initialSettings = initialSettings;
  }

  const runtime = new CoreRuntime(config);

  process.on('SIGINT', async () => {
    await runtime.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await runtime.stop();
    process.exit(0);
  });

  runtime.start().catch((err) => {
    console.error('[Core] Failed to start:', err);
    process.exit(1);
  });
}
