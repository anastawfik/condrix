#!/usr/bin/env node

import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { MaestroService } from './maestro-service.js';
import { logger } from './logger.js';

function getDefaultDbPath(): string {
  const dir = join(homedir(), '.condrix');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'maestro.db');
}

// ─── Global Error Handlers ─────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  logger.fatal('[Maestro]', 'Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal('[Maestro]', 'Unhandled rejection:', reason);
  process.exit(1);
});

const config = {
  maestroId: process.env.CONDRIX_MAESTRO_ID ?? 'maestro-primary',
  host: process.env.CONDRIX_MAESTRO_HOST ?? '0.0.0.0',
  port: Number(process.env.CONDRIX_MAESTRO_PORT ?? 9200),
  databasePath: process.env.CONDRIX_MAESTRO_DB ?? getDefaultDbPath(),
  tunnel: process.env.CONDRIX_MAESTRO_TUNNEL === 'true',
  tunnelMode: (process.env.CONDRIX_MAESTRO_TUNNEL_MODE ?? 'quick') as 'quick' | 'named',
  tunnelToken: process.env.CONDRIX_MAESTRO_TUNNEL_TOKEN,
};

const service = new MaestroService(config);

process.on('SIGINT', async () => {
  await service.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await service.stop();
  process.exit(0);
});

service.start().catch((err) => {
  console.error('[Maestro] Failed to start:', err);
  process.exit(1);
});
