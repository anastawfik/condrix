#!/usr/bin/env node

import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';

import { CoreRuntime } from './runtime.js';
import { AuthManager } from './auth.js';

const config = {
  coreId: process.env.NEXUS_CORE_ID ?? 'core-default',
  displayName: process.env.NEXUS_CORE_NAME ?? 'NexusCore',
  host: process.env.NEXUS_CORE_HOST ?? '0.0.0.0',
  port: Number(process.env.NEXUS_CORE_PORT ?? 9100),
  dbPath: process.env.NEXUS_CORE_DB_PATH ?? undefined,
  devMode: process.env.NEXUS_CORE_DEV_MODE !== 'false',
};

// Handle --generate-token command
if (process.argv.includes('--generate-token')) {
  const nameIndex = process.argv.indexOf('--generate-token') + 1;
  const name = process.argv[nameIndex] && !process.argv[nameIndex].startsWith('--')
    ? process.argv[nameIndex]
    : 'cli-generated';

  const dbDir = join(homedir(), '.nexuscore');
  mkdirSync(dbDir, { recursive: true });
  const dbPath = config.dbPath ?? join(dbDir, 'core.db');
  const db = new Database(dbPath);
  const authManager = new AuthManager(db);
  const token = authManager.generateToken(name);
  console.log(`Token generated:\n  Name:  ${token.name}\n  Token: ${token.token}`);
  db.close();
  process.exit(0);
}

// Handle --list-tokens command
if (process.argv.includes('--list-tokens')) {
  const dbDir = join(homedir(), '.nexuscore');
  const dbPath = config.dbPath ?? join(dbDir, 'core.db');
  const db = new Database(dbPath);
  const authManager = new AuthManager(db);
  const tokens = authManager.listTokens();
  if (tokens.length === 0) {
    console.log('No tokens found.');
  } else {
    for (const t of tokens) {
      console.log(`  ${t.name}: ${t.token.slice(0, 12)}... (created: ${t.createdAt})`);
    }
  }
  db.close();
  process.exit(0);
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
