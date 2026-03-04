import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['libs/*/vitest.config.ts', 'apps/*/vitest.config.ts']);
