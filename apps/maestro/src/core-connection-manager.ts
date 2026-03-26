/**
 * Manages WebSocket connections FROM Cores to Maestro.
 * Cores connect inbound; Maestro authenticates them and tracks online/offline state.
 */
import type { WebSocket } from 'ws';
import type { MessageEnvelope } from '@condrix/protocol';
import { generateMessageId, generateId } from '@condrix/protocol';
import type { MaestroDatabase, CoreRow } from './database.js';

export interface ConnectedCore {
  dbId: string;
  coreId: string;
  displayName: string;
  ws: WebSocket;
  authenticated: boolean;
  lastHeartbeat: number;
}

export class CoreConnectionManager {
  private cores = new Map<string, ConnectedCore>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  onCoreOnline?: (core: CoreRow) => void;
  onCoreOffline?: (core: CoreRow) => void;
  onCoreMessage?: (dbId: string, msg: MessageEnvelope) => void;

  constructor(private db: MaestroDatabase) {}

  start(): void {
    // Check for stale connections every 45s
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, core] of this.cores) {
        if (now - core.lastHeartbeat > 90_000) {
          console.log(`[Maestro] Core ${core.coreId} heartbeat timeout`);
          this.handleDisconnect(key);
        }
      }
    }, 45_000);
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const core of this.cores.values()) {
      core.ws.close();
    }
    this.cores.clear();
  }

  handleConnection(ws: WebSocket): void {
    const tempId = `pending_${generateMessageId()}`;

    const pending: ConnectedCore = {
      dbId: '',
      coreId: '',
      displayName: '',
      ws,
      authenticated: false,
      lastHeartbeat: Date.now(),
    };

    this.cores.set(tempId, pending);

    // Auth timeout: if Core doesn't authenticate within 10s, disconnect
    const authTimeout = setTimeout(() => {
      if (!pending.authenticated) {
        ws.close(4001, 'Authentication timeout');
        this.cores.delete(tempId);
      }
    }, 10_000);

    ws.on('message', (data) => {
      let msg: MessageEnvelope;
      try {
        msg = JSON.parse(data.toString()) as MessageEnvelope;
      } catch {
        return;
      }

      if (!pending.authenticated) {
        // Expect core:auth message
        if (msg.namespace === 'core' && msg.action === 'auth') {
          clearTimeout(authTimeout);
          this.handleCoreAuth(tempId, msg, ws);
        }
        return;
      }

      // Update heartbeat
      pending.lastHeartbeat = Date.now();

      // Forward to relay
      if (this.onCoreMessage) {
        this.onCoreMessage(pending.dbId, msg);
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      this.handleDisconnect(tempId);
      // Also try the dbId key
      for (const [key, core] of this.cores) {
        if (core.ws === ws) {
          this.handleDisconnect(key);
          break;
        }
      }
    });

    ws.on('error', () => {
      // onclose will fire
    });
  }

  sendToCore(dbId: string, msg: unknown): boolean {
    const core = this.cores.get(dbId);
    if (!core || !core.authenticated || core.ws.readyState !== 1 /* OPEN */) {
      return false;
    }
    core.ws.send(JSON.stringify(msg));
    return true;
  }

  isCoreOnline(dbId: string): boolean {
    const core = this.cores.get(dbId);
    return !!core && core.authenticated && core.ws.readyState === 1;
  }

  getConnectedCoreIds(): string[] {
    return Array.from(this.cores.entries())
      .filter(([, c]) => c.authenticated)
      .map(([key]) => key);
  }

  private handleCoreAuth(tempId: string, msg: MessageEnvelope, ws: WebSocket): void {
    const payload = msg.payload as { coreId?: string; accessToken?: string; displayName?: string };
    const { coreId, accessToken, displayName } = payload;

    if (!accessToken) {
      this.sendAuthResponse(ws, msg.id, false, 'Missing access token');
      ws.close(4003, 'Missing access token');
      this.cores.delete(tempId);
      return;
    }

    // Look up Core by access token in DB
    const coreRow = this.db.getCoreByAccessToken(accessToken);

    if (!coreRow) {
      // If coreId provided, auto-register (first-connect scenario)
      if (coreId) {
        const id = generateId('core');
        this.db.insertCore(id, coreId, displayName ?? coreId, accessToken);
        this.db.updateCoreStatus(id, 'online');

        const pending = this.cores.get(tempId)!;
        pending.dbId = id;
        pending.coreId = coreId;
        pending.displayName = displayName ?? coreId;
        pending.authenticated = true;

        // Re-key from tempId to dbId
        this.cores.delete(tempId);
        this.cores.set(id, pending);

        this.sendAuthResponse(ws, msg.id, true);
        console.log(`[Maestro] Core ${coreId} auto-registered and connected (id: ${id})`);

        const newCoreRow = this.db.getCore(id);
        if (newCoreRow && this.onCoreOnline) this.onCoreOnline(newCoreRow);
        return;
      }

      this.sendAuthResponse(ws, msg.id, false, 'Invalid access token');
      ws.close(4003, 'Invalid access token');
      this.cores.delete(tempId);
      return;
    }

    // Core found — authenticate
    this.db.updateCoreStatus(coreRow.id, 'online');

    const pending = this.cores.get(tempId)!;
    pending.dbId = coreRow.id;
    pending.coreId = coreRow.core_id;
    pending.displayName = coreRow.display_name;
    pending.authenticated = true;

    // Re-key
    this.cores.delete(tempId);
    this.cores.set(coreRow.id, pending);

    this.sendAuthResponse(ws, msg.id, true);
    console.log(`[Maestro] Core ${coreRow.core_id} connected (id: ${coreRow.id})`);

    if (this.onCoreOnline) this.onCoreOnline(coreRow);
  }

  private handleDisconnect(key: string): void {
    const core = this.cores.get(key);
    if (!core) return;

    this.cores.delete(key);

    if (core.authenticated && core.dbId) {
      this.db.updateCoreStatus(core.dbId, 'offline');
      console.log(`[Maestro] Core ${core.coreId} disconnected`);

      const coreRow = this.db.getCore(core.dbId);
      if (coreRow && this.onCoreOffline) this.onCoreOffline(coreRow);
    }
  }

  private sendAuthResponse(ws: WebSocket, correlationId: string, success: boolean, errorMsg?: string): void {
    const response = {
      id: generateMessageId(),
      type: 'response' as const,
      namespace: 'core',
      action: 'auth',
      payload: { authenticated: success },
      timestamp: new Date().toISOString(),
      correlationId,
      success,
      ...(errorMsg ? { error: { code: 'AUTH_FAILED', message: errorMsg } } : {}),
    };
    ws.send(JSON.stringify(response));
  }
}
