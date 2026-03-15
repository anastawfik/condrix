#!/usr/bin/env node

import { MaestroService } from './maestro-service.js';

const config = {
  maestroId: process.env.NEXUS_MAESTRO_ID ?? 'maestro-primary',
  host: process.env.NEXUS_MAESTRO_HOST ?? '0.0.0.0',
  port: Number(process.env.NEXUS_MAESTRO_PORT ?? 9200),
  databasePath: process.env.NEXUS_MAESTRO_DB ?? './maestro.db',
  tunnel: process.env.NEXUS_MAESTRO_TUNNEL === 'true',
  tunnelMode: (process.env.NEXUS_MAESTRO_TUNNEL_MODE ?? 'quick') as 'quick' | 'named',
  tunnelToken: process.env.NEXUS_MAESTRO_TUNNEL_TOKEN,
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
