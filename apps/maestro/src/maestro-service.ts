import type { MaestroState, CoreInfo } from '@nexus-core/protocol';

export interface MaestroConfig {
  maestroId: string;
  host: string;
  port: number;
  databasePath: string;
}

/**
 * Main Maestro service. Maintains live connections to all registered Cores,
 * aggregates state, and serves as the primary conversational interface
 * for cross-cutting orchestration concerns.
 */
export class MaestroService {
  private config: MaestroConfig;
  private state: MaestroState = 'INITIALIZING';
  private cores = new Map<string, CoreInfo>();

  constructor(config: MaestroConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    // TODO: Load state from database, connect to registered Cores
    this.state = 'ACTIVE';
    console.log(
      `[Maestro] ${this.config.maestroId} starting on ${this.config.host}:${this.config.port}`,
    );
  }

  async stop(): Promise<void> {
    // TODO: Graceful shutdown, disconnect from all Cores
    console.log(`[Maestro] ${this.config.maestroId} stopping`);
  }

  getState(): MaestroState {
    return this.state;
  }

  getRegisteredCores(): CoreInfo[] {
    return Array.from(this.cores.values());
  }
}
