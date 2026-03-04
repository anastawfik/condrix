#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('nexus')
  .description('NexusCore CLI — Distributed AI Agent Orchestration')
  .version('0.1.0');

program
  .command('connect')
  .description('Connect to a NexusCore Core')
  .option('-u, --url <url>', 'Core WebSocket URL', 'ws://localhost:9100')
  .option('-t, --token <token>', 'Authentication token')
  .action((_options) => {
    // TODO: Initialize Ink app, connect to Core
    console.log('NexusCore CLI — connecting...');
  });

program
  .command('status')
  .description('Show status of connected Cores and workspaces')
  .action(() => {
    // TODO: Query Maestro or Core for status
    console.log('NexusCore Status — not yet implemented');
  });

program.parse();
