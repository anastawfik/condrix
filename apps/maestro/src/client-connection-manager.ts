/**
 * Manages WebSocket connections FROM clients to Maestro.
 * Clients authenticate with username/password or session token.
 */
import type { WebSocket } from 'ws';
import type { MessageEnvelope } from '@nexus-core/protocol';
import { generateMessageId } from '@nexus-core/protocol';
import type { AuthManager, SessionInfo } from './auth-manager.js';

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  session: SessionInfo | null;
  subscribedCores: Set<string>;
}

export class ClientConnectionManager {
  private clients = new Map<string, ConnectedClient>();

  onClientMessage?: (clientId: string, msg: MessageEnvelope) => void;

  constructor(private authManager: AuthManager) {}

  stop(): void {
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();
  }

  handleConnection(ws: WebSocket): void {
    const clientId = `client_${generateMessageId()}`;

    const client: ConnectedClient = {
      id: clientId,
      ws,
      session: null,
      subscribedCores: new Set(),
    };
    this.clients.set(clientId, client);

    ws.on('message', (data) => {
      let msg: MessageEnvelope;
      try {
        msg = JSON.parse(data.toString()) as MessageEnvelope;
      } catch {
        return;
      }

      // Handle maestro namespace messages directly
      if (msg.namespace === 'maestro') {
        if (msg.action === 'login') {
          this.handleLogin(client, msg);
          return;
        }
        if (msg.action === 'auth') {
          this.handleAuth(client, msg);
          return;
        }

        // All other maestro actions require authentication
        if (!client.session) {
          this.sendError(ws, msg.id, 'AUTH_REQUIRED', 'Authentication required');
          return;
        }
      }

      // For non-maestro messages, require auth
      if (!client.session && msg.namespace !== 'maestro') {
        this.sendError(ws, msg.id, 'AUTH_REQUIRED', 'Authentication required');
        return;
      }

      // Forward to relay
      if (this.onClientMessage) {
        this.onClientMessage(clientId, msg);
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
    });

    ws.on('error', () => {
      // onclose will fire
    });
  }

  sendToClient(clientId: string, msg: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1 /* OPEN */) return false;
    client.ws.send(JSON.stringify(msg));
    return true;
  }

  broadcastToSubscribers(coreDbId: string, msg: unknown): void {
    for (const client of this.clients.values()) {
      if (client.session && client.subscribedCores.has(coreDbId)) {
        if (client.ws.readyState === 1) {
          client.ws.send(JSON.stringify(msg));
        }
      }
    }
  }

  broadcastToAll(msg: unknown): void {
    for (const client of this.clients.values()) {
      if (client.session && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(msg));
      }
    }
  }

  subscribeClientToCore(clientId: string, coreDbId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscribedCores.add(coreDbId);
    }
  }

  getClient(clientId: string): ConnectedClient | undefined {
    return this.clients.get(clientId);
  }

  isAdmin(clientId: string): boolean {
    const client = this.clients.get(clientId);
    return client?.session?.role === 'admin';
  }

  getClientUserId(clientId: string): string | null {
    const client = this.clients.get(clientId);
    return client?.session?.userId ?? null;
  }

  private handleLogin(client: ConnectedClient, msg: MessageEnvelope): void {
    const payload = msg.payload as { username?: string; password?: string; totpCode?: string };
    const { username, password, totpCode } = payload;

    if (!username || !password) {
      this.sendLoginResponse(client.ws, msg.id, false, 'Missing credentials');
      return;
    }

    const result = this.authManager.login(username, password, totpCode);

    if ('error' in result) {
      this.sendLoginResponse(client.ws, msg.id, false, result.error, result.requiresTotp);
      return;
    }

    client.session = result;
    this.sendLoginResponse(client.ws, msg.id, true, undefined, undefined, result);
  }

  private handleAuth(client: ConnectedClient, msg: MessageEnvelope): void {
    const payload = msg.payload as { sessionToken?: string };

    if (!payload.sessionToken) {
      this.sendAuthResponse(client.ws, msg.id, false);
      return;
    }

    const session = this.authManager.validateSession(payload.sessionToken);
    if (!session) {
      this.sendAuthResponse(client.ws, msg.id, false);
      return;
    }

    client.session = session;
    this.sendAuthResponse(client.ws, msg.id, true, session);
  }

  private sendLoginResponse(
    ws: WebSocket,
    correlationId: string,
    success: boolean,
    errorMsg?: string,
    requiresTotp?: boolean,
    session?: SessionInfo,
  ): void {
    const response = {
      id: generateMessageId(),
      type: 'response' as const,
      namespace: 'maestro',
      action: 'login',
      payload: {
        authenticated: success,
        ...(session ? {
          sessionToken: session.token,
          expiresAt: session.expiresAt,
          user: { username: session.username, role: session.role },
        } : {}),
        ...(requiresTotp ? { requiresTotp: true } : {}),
      },
      timestamp: new Date().toISOString(),
      correlationId,
      success,
      ...(errorMsg ? { error: { code: 'AUTH_FAILED', message: errorMsg } } : {}),
    };
    ws.send(JSON.stringify(response));
  }

  private sendAuthResponse(ws: WebSocket, correlationId: string, success: boolean, session?: SessionInfo): void {
    const response = {
      id: generateMessageId(),
      type: 'response' as const,
      namespace: 'maestro',
      action: 'auth',
      payload: {
        authenticated: success,
        ...(session ? { user: { username: session.username, role: session.role } } : {}),
      },
      timestamp: new Date().toISOString(),
      correlationId,
      success,
      ...(success ? {} : { error: { code: 'AUTH_FAILED', message: 'Invalid session' } }),
    };
    ws.send(JSON.stringify(response));
  }

  private sendError(ws: WebSocket, correlationId: string, code: string, message: string): void {
    const response = {
      id: generateMessageId(),
      type: 'response' as const,
      namespace: 'maestro',
      action: 'error',
      payload: {},
      timestamp: new Date().toISOString(),
      correlationId,
      success: false,
      error: { code, message },
    };
    ws.send(JSON.stringify(response));
  }
}
