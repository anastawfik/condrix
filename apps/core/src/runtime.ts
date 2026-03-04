import type { CoreInfo } from '@nexus-core/protocol';

export interface CoreConfig {
  coreId: string;
  displayName: string;
  host: string;
  port: number;
}

/**
 * Central orchestrator within a Core.
 * Initializes all managers, handles configuration, manages the WebSocket server,
 * and routes messages between internal components and external clients/Maestro.
 */
export class CoreRuntime {
  private config: CoreConfig;
  private running = false;

  constructor(config: CoreConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.running = true;
    // TODO: Initialize managers, start WebSocket server
    console.log(`[Core] ${this.config.displayName} starting on ${this.config.host}:${this.config.port}`);
  }

  async stop(): Promise<void> {
    this.running = false;
    // TODO: Graceful shutdown of all managers
    console.log(`[Core] ${this.config.displayName} stopping`);
  }

  getInfo(): CoreInfo {
    return {
      coreId: this.config.coreId,
      displayName: this.config.displayName,
      host: this.config.host,
      port: this.config.port,
      status: this.running ? 'online' : 'offline',
      lastHeartbeat: new Date().toISOString(),
    };
  }
}
