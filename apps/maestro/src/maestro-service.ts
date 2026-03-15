/**
 * Main Maestro service. Central orchestration hub that:
 * - Accepts WebSocket connections from Cores and Clients
 * - Authenticates users (username/password + TOTP)
 * - Relays messages between clients and Cores
 * - Distributes AI configuration to all connected Cores
 */
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { MaestroState } from '@nexus-core/protocol';
import { generateMessageId } from '@nexus-core/protocol';

import { EventEmitter } from 'node:events';

import { MaestroDatabase } from './database.js';
import { AuthManager } from './auth-manager.js';
import { CoreConnectionManager } from './core-connection-manager.js';
import { ClientConnectionManager } from './client-connection-manager.js';
import { MessageRelay } from './message-relay.js';
import { AiConfigDistributor } from './ai-config-distributor.js';
import { OAuthManager } from './oauth-manager.js';
import { TunnelManager } from './tunnel-manager.js';

export interface MaestroConfig {
  maestroId: string;
  host: string;
  port: number;
  databasePath: string;
  tunnel?: boolean;
  tunnelMode?: 'quick' | 'named';
  tunnelToken?: string;
}

export class MaestroService {
  private config: MaestroConfig;
  private state: MaestroState = 'INITIALIZING';

  private db!: MaestroDatabase;
  private authManager!: AuthManager;
  private coreManager!: CoreConnectionManager;
  private clientManager!: ClientConnectionManager;
  private messageRelay!: MessageRelay;
  private aiConfigDistributor!: AiConfigDistributor;
  private oauthManager!: OAuthManager;
  private tunnelManager: TunnelManager | null = null;
  private emitter = new EventEmitter();
  private wss!: WebSocketServer;

  /** The public tunnel URL, if a tunnel is running. */
  tunnelUrl: string | null = null;

  constructor(config: MaestroConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    console.log(
      `[Maestro] ${this.config.maestroId} starting on ${this.config.host}:${this.config.port}`,
    );

    // 1. Init database
    this.db = new MaestroDatabase({ path: this.config.databasePath });

    // 2. Init auth manager + ensure default admin
    this.authManager = new AuthManager(this.db);
    this.authManager.ensureDefaultAdmin();

    // 3. Init AI config distributor + OAuth manager
    this.aiConfigDistributor = new AiConfigDistributor(this.db);
    this.oauthManager = new OAuthManager(this.db);
    this.oauthManager.setDistributor(this.aiConfigDistributor);

    // 4. Init connection managers
    this.coreManager = new CoreConnectionManager(this.db);
    this.clientManager = new ClientConnectionManager(this.authManager);

    // Wire AI config distributor to core manager
    this.aiConfigDistributor.setCoreManager(this.coreManager);

    // 5. Init message relay
    this.messageRelay = new MessageRelay(
      this.db,
      this.authManager,
      this.coreManager,
      this.clientManager,
      this.aiConfigDistributor,
    );
    this.messageRelay.setOAuthManager(this.oauthManager);

    // 6. Wire Core events
    this.coreManager.onCoreOnline = (coreRow) => {
      // Push AI config to newly connected Core
      this.aiConfigDistributor.pushToCore(coreRow.id);

      // Notify all clients
      this.clientManager.broadcastToAll({
        id: generateMessageId(),
        type: 'event',
        namespace: 'maestro',
        action: 'core.online',
        payload: {
          id: coreRow.id,
          coreId: coreRow.core_id,
          displayName: coreRow.display_name,
        },
        timestamp: new Date().toISOString(),
      });
    };

    this.coreManager.onCoreOffline = (coreRow) => {
      this.clientManager.broadcastToAll({
        id: generateMessageId(),
        type: 'event',
        namespace: 'maestro',
        action: 'core.offline',
        payload: {
          id: coreRow.id,
          coreId: coreRow.core_id,
          displayName: coreRow.display_name,
        },
        timestamp: new Date().toISOString(),
      });
    };

    // Wire Core messages to relay
    this.coreManager.onCoreMessage = (dbId, msg) => {
      this.messageRelay.handleCoreMessage(dbId, msg);
    };

    // Wire Client messages to relay
    this.clientManager.onClientMessage = (clientId, msg) => {
      this.messageRelay.handleClientMessage(clientId, msg);
    };

    // 7. Start WebSocket server
    this.wss = new WebSocketServer({
      host: this.config.host,
      port: this.config.port,
      maxPayload: 1024 * 1024, // 1 MiB
    });

    this.wss.on('connection', (ws, req: IncomingMessage) => {
      // Determine if this is a Core or Client connection
      // Cores connect with an upgrade header hint or use core:auth as first message
      // We treat all connections the same initially; the first message determines the type
      this.handleNewConnection(ws, req);
    });

    // Start core manager heartbeat checks
    this.coreManager.start();

    this.state = 'ACTIVE';
    console.log(
      `[Maestro] ${this.config.maestroId} ready on ${this.config.host}:${this.config.port}`,
    );

    // Start tunnel if configured
    if (this.config.tunnel) {
      this.startTunnel().catch((err) => {
        console.warn(`[Maestro] Tunnel failed: ${(err as Error).message}`);
      });
    }
  }

  private async startTunnel(): Promise<void> {
    this.tunnelManager = new TunnelManager(this.emitter, this.config.port);

    const installed = await this.tunnelManager.isInstalled();
    if (!installed) {
      console.log('[Maestro] cloudflared not found, installing...');
      const result = await this.tunnelManager.install();
      if (!result.success) {
        throw new Error(result.message);
      }
    }

    const mode = this.config.tunnelMode ?? 'quick';
    if (mode === 'named' && this.config.tunnelToken) {
      await this.tunnelManager.startNamed(this.config.tunnelToken);
      console.log('[Maestro] Named tunnel started');
    } else {
      const url = await this.tunnelManager.startQuick();
      this.tunnelUrl = url;
      // Convert https:// to wss:// for WebSocket connections
      const wsUrl = url.replace('https://', 'wss://');
      console.log(`[Maestro] Tunnel URL: ${wsUrl}`);
      console.log(`[Maestro] Remote Cores can connect with: NEXUS_MAESTRO_URL="${wsUrl}"`);
    }
  }

  async stop(): Promise<void> {
    console.log(`[Maestro] ${this.config.maestroId} stopping`);

    this.tunnelManager?.destroy();
    this.oauthManager?.destroy();
    this.coreManager?.stop();
    this.clientManager?.stop();

    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss.close(() => resolve());
      });
    }

    this.db?.close();
    console.log(`[Maestro] ${this.config.maestroId} stopped`);
  }

  getState(): MaestroState {
    return this.state;
  }

  private handleNewConnection(ws: import('ws').WebSocket, _req: IncomingMessage): void {
    // We use a "first message determines type" approach:
    // - If the first message is core:auth → route to CoreConnectionManager
    // - Otherwise → route to ClientConnectionManager
    let routed = false;

    const onFirstMessage = (data: import('ws').RawData) => {
      if (routed) return;

      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      routed = true;
      ws.removeListener('message', onFirstMessage);

      if (msg.namespace === 'core' && msg.action === 'auth') {
        // This is a Core connecting
        this.coreManager.handleConnection(ws);
        // Re-emit the auth message so the core connection manager can process it
        ws.emit('message', data);
      } else {
        // This is a Client connecting
        this.clientManager.handleConnection(ws);
        // Re-emit the first message so the client connection manager can process it
        ws.emit('message', data);
      }
    };

    ws.on('message', onFirstMessage);

    // If no message received within 30s, assume client
    setTimeout(() => {
      if (!routed) {
        routed = true;
        ws.removeListener('message', onFirstMessage);
        this.clientManager.handleConnection(ws);
      }
    }, 30_000);
  }
}
