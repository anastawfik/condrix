#!/usr/bin/env node

import { CoreRuntime } from './runtime.js';

const config = {
  coreId: process.env.NEXUS_CORE_ID ?? 'core-default',
  displayName: process.env.NEXUS_CORE_NAME ?? 'NexusCore',
  host: process.env.NEXUS_CORE_HOST ?? '0.0.0.0',
  port: Number(process.env.NEXUS_CORE_PORT ?? 9100),
  dbPath: process.env.NEXUS_CORE_DB_PATH ?? undefined,
  devMode: process.env.NEXUS_CORE_DEV_MODE !== 'false',
};

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
