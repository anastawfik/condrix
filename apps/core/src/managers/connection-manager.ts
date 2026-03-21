import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { EventEmitter } from 'node:events';
import { generateId } from '@nexus-core/protocol';
import type { AuthScope } from '@nexus-core/protocol';

import type { MessageRouter } from '../message-router.js';
import type { AuthManager } from '../auth.js';

export type HttpRouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

const ALL_SCOPES: AuthScope[] = [
  'read:files', 'write:files', 'exec:terminal',
  'admin:workspace', 'admin:project', 'admin:core',
  'chat:agent', 'chat:maestro',
];

const HEARTBEAT_INTERVAL = 15_000;
const HEARTBEAT_TIMEOUT = 45_000;

/** Max messages per second per client before rate limiting. */
const RATE_LIMIT_PER_SECOND = 50;
/** Window size for rate limiting (ms). */
const RATE_LIMIT_WINDOW = 1_000;

export interface ClientSession {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
  scopes: AuthScope[];
  subscribedPatterns: string[];
  workspaceId?: string;
  lastPong: number;
  isTunneled: boolean;
  /** Rate limiting state. */
  rateLimitCounter: number;
  rateLimitWindowStart: number;
}

/**
 * Manages all inbound WebSocket connections.
 * Handles authentication, session tracking, message routing,
 * and event subscription for connected clients.
 */
export class ConnectionManager {
  private httpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private sessions = new Map<string, ClientSession>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private devMode: boolean;
  private authManager: AuthManager | null;
  private externalAccessEnabled = false;
  private httpRoutes = new Map<string, HttpRouteHandler>();

  constructor(
    private router: MessageRouter,
    private emitter: EventEmitter,
    options?: { devMode?: boolean; authManager?: AuthManager },
  ) {
    this.devMode = options?.devMode ?? true;
    this.authManager = options?.authManager ?? null;
  }

  /** Enable/disable external access (for tunnel connections). */
  setExternalAccessEnabled(enabled: boolean): void {
    this.externalAccessEnabled = enabled;
  }

  /** Register an HTTP route handler on the Core's server (e.g. for OAuth callbacks). */
  registerHttpRoute(path: string, handler: HttpRouteHandler): void {
    this.httpRoutes.set(path, handler);
  }

  async start(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create HTTP server to handle both WebSocket upgrades and HTTP routes
      this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', `http://localhost`);
        const handler = this.httpRoutes.get(url.pathname);
        if (handler) {
          handler(req, res);
          return;
        }
        res.writeHead(426, { 'Content-Type': 'text/plain' });
        res.end('WebSocket connections only');
      });

      this.wss = new WebSocketServer({
        server: this.httpServer,
        maxPayload: 1 * 1024 * 1024, // 1 MiB limit
        verifyClient: (info, cb) => {
          const origin = info.origin ?? info.req.headers.origin ?? '';
          const isLocalhost = !origin
            || origin.startsWith('http://localhost')
            || origin.startsWith('http://127.0.0.1')
            || origin.startsWith('http://[::1]');

          // In dev mode without external access, only allow localhost
          if (this.devMode && !isLocalhost && !this.externalAccessEnabled) {
            console.warn(`[ConnectionManager] Rejected connection from non-local origin: ${origin}`);
            cb(false, 403, 'Forbidden: non-localhost origin');
            return;
          }
          cb(true);
        },
      });

      this.httpServer.on('listening', () => {
        console.log(`[ConnectionManager] WebSocket server listening on ${host}:${port}`);
        this.startHeartbeat();
        resolve();
      });

      this.httpServer.on('error', (err) => {
        reject(err);
      });

      this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        this.handleConnection(ws, req);
      });

      this.httpServer.listen(port, host);
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Cloudflare tunnel adds Cf-Connecting-Ip header to forwarded requests
    const isTunneled = !!req.headers['cf-connecting-ip'];

    const session: ClientSession = {
      id: generateId('sess'),
      ws,
      authenticated: false,
      scopes: [],
      subscribedPatterns: [],
      lastPong: Date.now(),
      isTunneled,
      rateLimitCounter: 0,
      rateLimitWindowStart: Date.now(),
    };

    // In dev mode, auto-authenticate direct local connections.
    // Tunneled connections always require token auth for security.
    if (this.devMode && !isTunneled) {
      session.authenticated = true;
      session.scopes = [...ALL_SCOPES];
    }

    this.sessions.set(session.id, session);
    this.emitter.emit('core:connected', { coreId: session.id, timestamp: new Date().toISOString() });

    ws.on('pong', () => {
      session.lastPong = Date.now();
    });

    ws.on('message', (data: Buffer | string) => {
      const raw = typeof data === 'string' ? data : data.toString('utf-8');
      this.handleMessage(session, raw);
    });

    ws.on('close', () => {
      this.sessions.delete(session.id);
      this.emitter.emit('core:disconnected', { coreId: session.id });
    });

    ws.on('error', () => {
      this.sessions.delete(session.id);
    });
  }

  private handleMessage(session: ClientSession, raw: string): void {
    // Rate limiting
    const now = Date.now();
    if (now - session.rateLimitWindowStart > RATE_LIMIT_WINDOW) {
      session.rateLimitCounter = 0;
      session.rateLimitWindowStart = now;
    }
    session.rateLimitCounter++;
    if (session.rateLimitCounter > RATE_LIMIT_PER_SECOND) {
      this.send(session, {
        id: '',
        type: 'response',
        namespace: 'core',
        action: 'error',
        payload: {},
        timestamp: new Date().toISOString(),
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many messages, slow down' },
      });
      return;
    }

    // Try to parse to check for auth & subscribe messages
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Will be handled by router
    }

    // Handle auth
    if (parsed?.namespace === 'core' && parsed?.action === 'auth' && parsed?.type === 'request') {
      this.handleAuth(session, parsed);
      return;
    }

    // Handle subscribe
    if (parsed?.namespace === 'core' && parsed?.action === 'subscribe' && parsed?.type === 'request') {
      this.handleSubscribe(session, parsed);
      return;
    }

    // Require auth for other messages
    if (!session.authenticated) {
      this.send(session, {
        id: '',
        type: 'response',
        namespace: 'core',
        action: 'error',
        payload: {},
        timestamp: new Date().toISOString(),
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
      return;
    }

    // Route to handler
    this.router.dispatch(raw, (response) => {
      this.send(session, response);
    });
  }

  private handleAuth(session: ClientSession, msg: Record<string, unknown>): void {
    const payload = msg.payload as { token?: string } | undefined;

    if (this.devMode && !session.isTunneled) {
      // Dev mode: accept any token for local connections
      session.authenticated = true;
      session.scopes = [...ALL_SCOPES];
    } else if (this.authManager && payload?.token) {
      // Token mode: validate against AuthManager
      const result = this.authManager.validateToken(payload.token);
      if (!result.valid) {
        this.send(session, {
          id: '',
          type: 'response',
          namespace: 'core',
          action: 'auth',
          payload: { authenticated: false, scopes: [] },
          timestamp: new Date().toISOString(),
          correlationId: msg.id as string,
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
        });
        return;
      }
      session.authenticated = true;
      session.scopes = result.scopes;
    } else {
      this.send(session, {
        id: '',
        type: 'response',
        namespace: 'core',
        action: 'auth',
        payload: { authenticated: false, scopes: [] },
        timestamp: new Date().toISOString(),
        correlationId: msg.id as string,
        success: false,
        error: { code: 'TOKEN_REQUIRED', message: 'Token required for authentication' },
      });
      return;
    }

    this.send(session, {
      id: '',
      type: 'response',
      namespace: 'core',
      action: 'auth',
      payload: {
        authenticated: true,
        scopes: session.scopes,
        sessionId: session.id,
      },
      timestamp: new Date().toISOString(),
      correlationId: msg.id as string,
      success: true,
    });
  }

  private handleSubscribe(session: ClientSession, msg: Record<string, unknown>): void {
    const payload = msg.payload as { subscribe?: string[]; unsubscribe?: string[] } | undefined;
    if (payload?.subscribe) {
      for (const pattern of payload.subscribe) {
        if (!session.subscribedPatterns.includes(pattern)) {
          session.subscribedPatterns.push(pattern);
        }
      }
    }
    if (payload?.unsubscribe) {
      session.subscribedPatterns = session.subscribedPatterns.filter(
        (p) => !payload.unsubscribe!.includes(p),
      );
    }

    this.send(session, {
      id: '',
      type: 'response',
      namespace: 'core',
      action: 'subscribe',
      payload: { subscribed: session.subscribedPatterns },
      timestamp: new Date().toISOString(),
      correlationId: msg.id as string,
      success: true,
    });
  }

  send(session: ClientSession, message: unknown): void {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(message));
    }
  }

  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    const msg = message as { namespace?: string; action?: string; workspaceId?: string };
    const eventKey = msg.namespace && msg.action ? `${msg.namespace}:${msg.action}` : '';

    for (const session of this.sessions.values()) {
      if (!session.authenticated) continue;
      if (session.ws.readyState !== WebSocket.OPEN) continue;

      // Check subscription patterns
      if (session.subscribedPatterns.length > 0 && eventKey) {
        const matches = session.subscribedPatterns.some((pattern) =>
          this.matchPattern(pattern, eventKey),
        );
        if (!matches) continue;
      }

      session.ws.send(data);
    }
  }

  broadcastToWorkspace(workspaceId: string, message: unknown): void {
    const data = JSON.stringify(message);
    for (const session of this.sessions.values()) {
      if (!session.authenticated) continue;
      if (session.ws.readyState !== WebSocket.OPEN) continue;
      if (session.workspaceId && session.workspaceId !== workspaceId) continue;
      session.ws.send(data);
    }
  }

  private matchPattern(pattern: string, eventKey: string): boolean {
    if (pattern === '*') return true;
    if (pattern === eventKey) return true;
    // Support wildcard: "workspace:*" matches "workspace:created"
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1);
      return eventKey.startsWith(prefix);
    }
    return false;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions) {
        if (now - session.lastPong > HEARTBEAT_TIMEOUT) {
          session.ws.terminate();
          this.sessions.delete(id);
          continue;
        }
        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.ping();
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  getConnectionCount(): number {
    return this.sessions.size;
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all connections
    for (const session of this.sessions.values()) {
      session.ws.close(1001, 'Server shutting down');
    }
    this.sessions.clear();

    // Close servers
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }
  }
}
