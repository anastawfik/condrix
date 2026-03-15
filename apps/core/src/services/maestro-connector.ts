/**
 * Outbound WebSocket client from Core to Maestro.
 * Handles authentication, reconnection, heartbeat, and message forwarding.
 */
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { generateMessageId } from '@nexus-core/protocol';
import type { MessageEnvelope } from '@nexus-core/protocol';

export interface MaestroConnectorConfig {
  url: string;
  accessToken: string;
  coreId: string;
  displayName: string;
}

const HEARTBEAT_INTERVAL = 30_000;
const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export class MaestroConnector {
  private ws: WebSocket | null = null;
  private config: MaestroConnectorConfig | null = null;
  private authenticated = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  /**
   * Callback for incoming relayed requests from Maestro.
   * The Core's MessageRouter should handle these.
   */
  onMessage?: (msg: MessageEnvelope) => void;

  constructor(private emitter: EventEmitter) {}

  get connected(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  connect(config: MaestroConnectorConfig): void {
    this.config = config;
    this.destroyed = false;
    this.doConnect();
  }

  disconnect(): void {
    this.destroyed = true;
    this.cleanup();
  }

  /**
   * Send a message to Maestro (used for forwarding local events).
   */
  send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Forward a response back to Maestro (for relayed requests).
   */
  sendResponse(msg: unknown): void {
    this.send(msg);
  }

  destroy(): void {
    this.disconnect();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private doConnect(): void {
    if (this.destroyed || !this.config) return;

    const { url, accessToken, coreId, displayName } = this.config;
    console.log(`[Core] Connecting to Maestro at ${url}...`);

    try {
      this.ws = new WebSocket(url, { family: 4 });
    } catch (err) {
      console.warn(`[Core] Failed to create WebSocket to Maestro: ${(err as Error).message}`);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.reconnectAttempt = 0;
      this.authenticated = false;

      // Send core:auth handshake
      const authMsg = {
        id: generateMessageId(),
        type: 'request' as const,
        namespace: 'core',
        action: 'auth',
        payload: { coreId, accessToken, displayName },
        timestamp: new Date().toISOString(),
      };
      this.ws!.send(JSON.stringify(authMsg));
    });

    this.ws.on('message', (data) => {
      let msg: MessageEnvelope;
      try {
        msg = JSON.parse(data.toString()) as MessageEnvelope;
      } catch {
        return;
      }

      // Handle auth response
      if (!this.authenticated && msg.namespace === 'core' && msg.action === 'auth' && msg.type === 'response') {
        const resp = msg as MessageEnvelope & { success?: boolean; error?: { message: string } };
        if (resp.success) {
          this.authenticated = true;
          console.log(`[Core] Connected to Maestro`);
          this.startHeartbeat();
          this.emitter.emit('maestro:connected', {});
        } else {
          console.error(`[Core] Maestro auth failed: ${resp.error?.message ?? 'unknown'}`);
          this.ws?.close();
        }
        return;
      }

      // Handle incoming relayed requests from Maestro
      if (this.authenticated && this.onMessage) {
        this.onMessage(msg);
      }
    });

    this.ws.on('close', () => {
      const wasAuthenticated = this.authenticated;
      this.cleanup();

      if (wasAuthenticated) {
        console.log('[Core] Disconnected from Maestro');
        this.emitter.emit('maestro:disconnected', {});
      }

      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      console.warn(`[Core] Maestro WebSocket error: ${err.message}`);
      // onclose will fire
    });
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.authenticated = false;
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempt++;
    console.log(`[Core] Reconnecting to Maestro in ${(delay / 1000).toFixed(1)}s...`);

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const msg = {
          id: generateMessageId(),
          type: 'request' as const,
          namespace: 'core',
          action: 'health',
          payload: {},
          timestamp: new Date().toISOString(),
        };
        this.ws.send(JSON.stringify(msg));
      }
    }, HEARTBEAT_INTERVAL);
  }
}
