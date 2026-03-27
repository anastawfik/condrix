/**
 * Manages outbound WebSocket connections from Maestro TO remote Cores.
 * Used when Cores are behind persistent Cloudflare tunnels and can't
 * initiate connections to Maestro themselves.
 *
 * Authenticates using token + optional TOTP 2FA.
 * Auto-reconnects with exponential backoff.
 */
import { WebSocket } from 'ws';
import { randomBytes, createHmac } from 'node:crypto';
import { generateMessageId } from '@condrix/protocol';
import type { MessageEnvelope } from '@condrix/protocol';
import type { MaestroDatabase, CoreRow } from './database.js';

const HEARTBEAT_INTERVAL = 30_000;
const INITIAL_RECONNECT_DELAY = 2_000;
const MAX_RECONNECT_DELAY = 60_000;

interface OutboundConnection {
  coreDbId: string;
  ws: WebSocket | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelay: number;
  authenticated: boolean;
  destroyed: boolean;
}

export class OutboundCoreConnector {
  private connections = new Map<string, OutboundConnection>();

  /** Called when a Core sends a message through the outbound connection. */
  onCoreMessage: ((coreDbId: string, msg: MessageEnvelope) => void) | null = null;
  /** Called when an outbound Core comes online. */
  onCoreOnline: ((coreRow: CoreRow) => void) | null = null;
  /** Called when an outbound Core goes offline. */
  onCoreOffline: ((coreRow: CoreRow) => void) | null = null;

  constructor(private db: MaestroDatabase) {}

  /** Connect to a Core via its tunnel URL. */
  connect(coreDbId: string): void {
    if (this.connections.has(coreDbId)) {
      this.disconnect(coreDbId);
    }

    const coreRow = this.db.getCore(coreDbId);
    if (!coreRow?.tunnel_url) {
      console.warn(`[OutboundConnector] Core ${coreDbId} has no tunnel URL`);
      return;
    }

    const conn: OutboundConnection = {
      coreDbId,
      ws: null,
      heartbeatTimer: null,
      reconnectTimer: null,
      reconnectDelay: INITIAL_RECONNECT_DELAY,
      authenticated: false,
      destroyed: false,
    };
    this.connections.set(coreDbId, conn);

    this.initiateConnection(conn, coreRow);
  }

  /** Disconnect from a Core. */
  disconnect(coreDbId: string): void {
    const conn = this.connections.get(coreDbId);
    if (!conn) return;

    conn.destroyed = true;
    this.cleanupConnection(conn);
    this.connections.delete(coreDbId);

    const coreRow = this.db.getCore(coreDbId);
    if (coreRow) {
      this.db.updateCoreStatus(coreDbId, 'offline');
      this.onCoreOffline?.(coreRow);
    }
  }

  /** Check if connected to a Core. */
  isConnected(coreDbId: string): boolean {
    const conn = this.connections.get(coreDbId);
    return conn?.authenticated === true && conn.ws?.readyState === WebSocket.OPEN;
  }

  /** Send a message to a Core via outbound connection. */
  sendToCore(coreDbId: string, msg: MessageEnvelope): boolean {
    const conn = this.connections.get(coreDbId);
    if (!conn?.ws || conn.ws.readyState !== WebSocket.OPEN || !conn.authenticated) {
      return false;
    }
    conn.ws.send(JSON.stringify(msg));
    return true;
  }

  /** Get all connected outbound Core IDs. */
  getConnectedCoreIds(): string[] {
    const ids: string[] = [];
    for (const [id, conn] of this.connections) {
      if (conn.authenticated && conn.ws?.readyState === WebSocket.OPEN) {
        ids.push(id);
      }
    }
    return ids;
  }

  /** Connect to all registered outbound Cores on startup. */
  connectAll(): void {
    const outboundCores = this.db.getOutboundCores();
    for (const core of outboundCores) {
      console.log(
        `[OutboundConnector] Auto-connecting to ${core.display_name} at ${core.tunnel_url}`,
      );
      this.connect(core.id);
    }
  }

  /** Disconnect all and clean up. */
  destroy(): void {
    for (const [id] of this.connections) {
      this.disconnect(id);
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private initiateConnection(conn: OutboundConnection, coreRow: CoreRow): void {
    if (conn.destroyed) return;

    const url = coreRow.tunnel_url!;
    console.log(`[OutboundConnector] Connecting to ${coreRow.display_name} at ${url}`);

    try {
      const ws = new WebSocket(url, { handshakeTimeout: 10_000 });
      conn.ws = ws;

      ws.on('open', () => {
        console.log(`[OutboundConnector] Connected to ${coreRow.display_name}, authenticating...`);
        conn.reconnectDelay = INITIAL_RECONNECT_DELAY;

        // Send auth message with token + optional TOTP
        const authPayload: Record<string, string> = {
          token: coreRow.access_token,
        };
        if (coreRow.totp_enabled && coreRow.totp_secret) {
          authPayload.totpCode = this.generateTotpCode(coreRow.totp_secret);
        }

        ws.send(
          JSON.stringify({
            id: generateMessageId(),
            type: 'request',
            namespace: 'core',
            action: 'auth',
            payload: authPayload,
            timestamp: new Date().toISOString(),
          }),
        );
      });

      ws.on('message', (data) => {
        let msg: MessageEnvelope;
        try {
          msg = JSON.parse(data.toString()) as MessageEnvelope;
        } catch {
          return;
        }

        // Handle auth response
        if (msg.namespace === 'core' && msg.action === 'auth' && msg.type === 'response') {
          if ((msg as MessageEnvelope & { success?: boolean }).success) {
            conn.authenticated = true;
            this.db.updateCoreStatus(conn.coreDbId, 'online');
            console.log(`[OutboundConnector] Authenticated with ${coreRow.display_name}`);
            this.startHeartbeat(conn);
            this.onCoreOnline?.(coreRow);
          } else {
            const error = (msg as Record<string, unknown>).error as
              | { code?: string; message?: string }
              | undefined;
            console.error(
              `[OutboundConnector] Auth failed for ${coreRow.display_name}: ${error?.message ?? 'unknown'}`,
            );
            ws.close();
          }
          return;
        }

        // Forward other messages
        if (conn.authenticated) {
          this.onCoreMessage?.(conn.coreDbId, msg);
        }
      });

      ws.on('close', () => {
        const wasAuthenticated = conn.authenticated;
        conn.authenticated = false;
        this.cleanupTimers(conn);

        if (wasAuthenticated) {
          this.db.updateCoreStatus(conn.coreDbId, 'offline');
          this.onCoreOffline?.(coreRow);
        }

        if (!conn.destroyed) {
          this.scheduleReconnect(conn, coreRow);
        }
      });

      ws.on('error', (err) => {
        console.error(`[OutboundConnector] Error with ${coreRow.display_name}: ${err.message}`);
      });
    } catch (err) {
      console.error(
        `[OutboundConnector] Failed to connect to ${coreRow.display_name}: ${(err as Error).message}`,
      );
      if (!conn.destroyed) {
        this.scheduleReconnect(conn, coreRow);
      }
    }
  }

  private startHeartbeat(conn: OutboundConnection): void {
    conn.heartbeatTimer = setInterval(() => {
      if (conn.ws?.readyState === WebSocket.OPEN) {
        conn.ws.ping();
      }
    }, HEARTBEAT_INTERVAL);
  }

  private scheduleReconnect(conn: OutboundConnection, coreRow: CoreRow): void {
    console.log(
      `[OutboundConnector] Reconnecting to ${coreRow.display_name} in ${conn.reconnectDelay / 1000}s...`,
    );
    conn.reconnectTimer = setTimeout(() => {
      // Re-read core row in case token/URL changed
      const freshRow = this.db.getCore(conn.coreDbId);
      if (freshRow?.tunnel_url) {
        this.initiateConnection(conn, freshRow);
      }
    }, conn.reconnectDelay);
    conn.reconnectDelay = Math.min(conn.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }

  private cleanupTimers(conn: OutboundConnection): void {
    if (conn.heartbeatTimer) {
      clearInterval(conn.heartbeatTimer);
      conn.heartbeatTimer = null;
    }
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
  }

  private cleanupConnection(conn: OutboundConnection): void {
    this.cleanupTimers(conn);
    if (conn.ws) {
      conn.ws.removeAllListeners();
      if (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING) {
        conn.ws.close();
      }
      conn.ws = null;
    }
  }

  // ─── TOTP Generation (RFC 6238) ───────────────────────────────────────────

  private generateTotpCode(secretHex: string): string {
    const now = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(now / 30);
    const secret = Buffer.from(secretHex, 'hex');
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(timeStep));

    const hmac = createHmac('sha1', secret).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const code =
      (((hmac[offset]! & 0x7f) << 24) |
        ((hmac[offset + 1]! & 0xff) << 16) |
        ((hmac[offset + 2]! & 0xff) << 8) |
        (hmac[offset + 3]! & 0xff)) %
      1000000;
    return code.toString().padStart(6, '0');
  }
}
