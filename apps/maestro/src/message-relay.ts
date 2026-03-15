/**
 * Routes messages between clients and Cores through Maestro.
 * Client requests with targetCoreId get forwarded to the right Core.
 * Core events get forwarded to subscribed clients with sourceCoreId.
 */
import type { MessageEnvelope } from '@nexus-core/protocol';
import { generateMessageId, generateId } from '@nexus-core/protocol';
import type { MaestroDatabase } from './database.js';
import type { CoreConnectionManager } from './core-connection-manager.js';
import type { ClientConnectionManager } from './client-connection-manager.js';
import type { AuthManager } from './auth-manager.js';
import type { AiConfigDistributor } from './ai-config-distributor.js';
import type { OAuthManager } from './oauth-manager.js';

interface PendingRelay {
  clientId: string;
  originalCorrelationId: string;
  relayCorrelationId: string;
}

export class MessageRelay {
  private pendingRelays = new Map<string, PendingRelay>();

  private oauthManager: OAuthManager | null = null;

  constructor(
    private db: MaestroDatabase,
    private authManager: AuthManager,
    private coreManager: CoreConnectionManager,
    private clientManager: ClientConnectionManager,
    private aiConfigDistributor: AiConfigDistributor,
  ) {}

  setOAuthManager(oauthManager: OAuthManager): void {
    this.oauthManager = oauthManager;
  }

  /**
   * Handle a message from a client. Either process maestro-namespace
   * messages locally or relay to the target Core.
   */
  handleClientMessage(clientId: string, msg: MessageEnvelope): void {
    if (msg.namespace === 'maestro') {
      this.handleMaestroAction(clientId, msg);
      return;
    }

    // Relay to Core — need targetCoreId
    const targetCoreId = (msg as MessageEnvelope & { targetCoreId?: string }).targetCoreId;
    if (!targetCoreId) {
      this.sendErrorToClient(clientId, msg.id, 'MISSING_TARGET', 'targetCoreId required for Core-bound messages');
      return;
    }

    // Verify Core exists and is online
    if (!this.coreManager.isCoreOnline(targetCoreId)) {
      this.sendErrorToClient(clientId, msg.id, 'CORE_OFFLINE', 'Target Core is offline');
      return;
    }

    // Auto-subscribe client to Core events
    this.clientManager.subscribeClientToCore(clientId, targetCoreId);

    // Relay with new message ID for tracking — Core responds with correlationId = msg.id
    const relayId = generateMessageId();
    const relayMsg = {
      ...msg,
      id: relayId,
    };
    // Remove targetCoreId from the relayed message (Core doesn't need it)
    delete (relayMsg as Record<string, unknown>)['targetCoreId'];

    this.pendingRelays.set(relayId, {
      clientId,
      originalCorrelationId: msg.id,
      relayCorrelationId: relayId,
    });

    // Timeout cleanup
    setTimeout(() => {
      this.pendingRelays.delete(relayId);
    }, 60_000);

    this.coreManager.sendToCore(targetCoreId, relayMsg);
  }

  /**
   * Handle a message from a Core. If it's a response to a relayed request,
   * forward it back to the originating client. If it's an event, broadcast
   * to subscribed clients.
   */
  handleCoreMessage(coreDbId: string, msg: MessageEnvelope): void {
    if (msg.type === 'response' && msg.correlationId) {
      // Check if this is a response to a relayed request
      const relay = this.pendingRelays.get(msg.correlationId);
      if (relay) {
        this.pendingRelays.delete(msg.correlationId);

        // Restore original correlationId and forward to client
        const clientMsg = {
          ...msg,
          correlationId: relay.originalCorrelationId,
          sourceCoreId: coreDbId,
        };
        this.clientManager.sendToClient(relay.clientId, clientMsg);
        return;
      }
    }

    if (msg.type === 'event') {
      // Add sourceCoreId and broadcast to subscribed clients
      const eventMsg = {
        ...msg,
        sourceCoreId: coreDbId,
      };
      this.clientManager.broadcastToSubscribers(coreDbId, eventMsg);
      return;
    }

    // Stream chunks/ends — also relay to subscribed clients
    if (msg.type === 'stream') {
      if (msg.correlationId) {
        const relay = this.pendingRelays.get(msg.correlationId);
        if (relay) {
          const clientMsg = {
            ...msg,
            correlationId: relay.originalCorrelationId,
            sourceCoreId: coreDbId,
          };
          this.clientManager.sendToClient(relay.clientId, clientMsg);
          return;
        }
      }
      // Broadcast stream events
      const streamMsg = { ...msg, sourceCoreId: coreDbId };
      this.clientManager.broadcastToSubscribers(coreDbId, streamMsg);
    }
  }

  // ─── Maestro Namespace Handlers ─────────────────────────────────────────

  private handleMaestroAction(clientId: string, msg: MessageEnvelope): void {
    switch (msg.action) {
      case 'cores.list':
        this.handleCoresList(clientId, msg);
        break;
      case 'cores.register':
        this.handleCoresRegister(clientId, msg);
        break;
      case 'cores.remove':
        this.handleCoresRemove(clientId, msg);
        break;
      case 'cores.rename':
        this.handleCoresRename(clientId, msg);
        break;
      case 'ai.config.get':
        this.handleAiConfigGet(clientId, msg);
        break;
      case 'ai.config.set':
        this.handleAiConfigSet(clientId, msg);
        break;
      // OAuth handlers
      case 'ai.oauth.login':
        this.handleOAuthLogin(clientId, msg);
        break;
      case 'ai.oauth.status':
        this.handleOAuthStatus(clientId, msg);
        break;
      case 'ai.oauth.import':
        this.handleOAuthImport(clientId, msg);
        break;
      case 'ai.oauth.refresh':
        this.handleOAuthRefresh(clientId, msg);
        break;
      // Auth self-service handlers
      case 'auth.changePassword':
        this.handleChangePassword(clientId, msg);
        break;
      case 'auth.totp.status':
        this.handleTotpStatus(clientId, msg);
        break;
      case 'auth.totp.setup':
        this.handleTotpSetup(clientId, msg);
        break;
      case 'auth.totp.enable':
        this.handleTotpEnable(clientId, msg);
        break;
      case 'auth.totp.disable':
        this.handleTotpDisable(clientId, msg);
        break;
      default:
        this.sendErrorToClient(clientId, msg.id, 'UNKNOWN_ACTION', `Unknown maestro action: ${msg.action}`);
    }
  }

  private handleCoresList(clientId: string, msg: MessageEnvelope): void {
    const cores = this.db.listCores().map((c) => ({
      id: c.id,
      coreId: c.core_id,
      displayName: c.display_name,
      status: this.coreManager.isCoreOnline(c.id) ? 'online' as const : 'offline' as const,
    }));

    this.sendResponse(clientId, msg, { cores });
  }

  private handleCoresRegister(clientId: string, msg: MessageEnvelope): void {
    if (!this.clientManager.isAdmin(clientId)) {
      this.sendErrorToClient(clientId, msg.id, 'FORBIDDEN', 'Admin role required');
      return;
    }

    const payload = msg.payload as { coreId?: string; displayName?: string; accessToken?: string };
    if (!payload.coreId || !payload.displayName || !payload.accessToken) {
      this.sendErrorToClient(clientId, msg.id, 'INVALID_PAYLOAD', 'coreId, displayName, and accessToken required');
      return;
    }

    const id = generateId('core');
    this.db.insertCore(id, payload.coreId, payload.displayName, payload.accessToken);
    this.sendResponse(clientId, msg, { id, coreId: payload.coreId, registered: true });
  }

  private handleCoresRemove(clientId: string, msg: MessageEnvelope): void {
    if (!this.clientManager.isAdmin(clientId)) {
      this.sendErrorToClient(clientId, msg.id, 'FORBIDDEN', 'Admin role required');
      return;
    }

    const payload = msg.payload as { id?: string };
    if (!payload.id) {
      this.sendErrorToClient(clientId, msg.id, 'INVALID_PAYLOAD', 'id required');
      return;
    }

    const removed = this.db.deleteCore(payload.id);
    this.sendResponse(clientId, msg, { id: payload.id, removed });
  }

  private handleCoresRename(clientId: string, msg: MessageEnvelope): void {
    const payload = msg.payload as { id?: string; displayName?: string };
    if (!payload.id || !payload.displayName) {
      this.sendErrorToClient(clientId, msg.id, 'INVALID_PAYLOAD', 'id and displayName required');
      return;
    }

    this.db.updateCoreDisplayName(payload.id, payload.displayName);
    this.sendResponse(clientId, msg, { id: payload.id, displayName: payload.displayName });
  }

  private handleAiConfigGet(clientId: string, msg: MessageEnvelope): void {
    const config = this.aiConfigDistributor.getConfig();
    this.sendResponse(clientId, msg, config);
  }

  private handleAiConfigSet(clientId: string, msg: MessageEnvelope): void {
    if (!this.clientManager.isAdmin(clientId)) {
      this.sendErrorToClient(clientId, msg.id, 'FORBIDDEN', 'Admin role required');
      return;
    }

    const payload = msg.payload as Record<string, unknown>;
    const pushedToCores = this.aiConfigDistributor.setConfig(payload);
    this.sendResponse(clientId, msg, { updated: true, pushedToCores });

    // Broadcast config update event to all clients
    const config = this.aiConfigDistributor.getConfig();
    this.clientManager.broadcastToAll({
      id: generateMessageId(),
      type: 'event',
      namespace: 'maestro',
      action: 'ai.configUpdated',
      payload: {
        method: config.method,
        pushedToCores,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // ─── OAuth Handlers ─────────────────────────────────────────────────────

  private async handleOAuthLogin(clientId: string, msg: MessageEnvelope): Promise<void> {
    if (!this.oauthManager) {
      this.sendErrorToClient(clientId, msg.id, 'NOT_CONFIGURED', 'OAuth manager not available');
      return;
    }

    try {
      const { url, completion } = await this.oauthManager.startBrowserLogin();
      this.sendResponse(clientId, msg, { url });

      // Handle completion asynchronously
      completion.then((result) => {
        this.clientManager.broadcastToAll({
          id: generateMessageId(),
          type: 'event',
          namespace: 'maestro',
          action: 'ai.oauthComplete',
          payload: result,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err) {
      this.sendErrorToClient(clientId, msg.id, 'OAUTH_ERROR', (err as Error).message);
    }
  }

  private handleOAuthStatus(clientId: string, msg: MessageEnvelope): void {
    if (!this.oauthManager) {
      this.sendResponse(clientId, msg, { authenticated: false, method: 'none' });
      return;
    }
    this.sendResponse(clientId, msg, this.oauthManager.getStatus());
  }

  private async handleOAuthImport(clientId: string, msg: MessageEnvelope): Promise<void> {
    if (!this.oauthManager) {
      this.sendErrorToClient(clientId, msg.id, 'NOT_CONFIGURED', 'OAuth manager not available');
      return;
    }

    try {
      const result = await this.oauthManager.importFromClaudeCode();
      this.sendResponse(clientId, msg, result);
    } catch (err) {
      this.sendErrorToClient(clientId, msg.id, 'IMPORT_ERROR', (err as Error).message);
    }
  }

  private async handleOAuthRefresh(clientId: string, msg: MessageEnvelope): Promise<void> {
    if (!this.oauthManager) {
      this.sendErrorToClient(clientId, msg.id, 'NOT_CONFIGURED', 'OAuth manager not available');
      return;
    }

    try {
      const result = await this.oauthManager.refreshAccessToken();
      this.sendResponse(clientId, msg, result);
    } catch (err) {
      this.sendResponse(clientId, msg, { success: false });
    }
  }

  // ─── Auth Self-Service Handlers ─────────────────────────────────────────

  private handleChangePassword(clientId: string, msg: MessageEnvelope): void {
    const userId = this.clientManager.getClientUserId(clientId);
    if (!userId) {
      this.sendErrorToClient(clientId, msg.id, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    const payload = msg.payload as { oldPassword?: string; newPassword?: string };
    if (!payload.oldPassword || !payload.newPassword) {
      this.sendErrorToClient(clientId, msg.id, 'INVALID_PAYLOAD', 'oldPassword and newPassword required');
      return;
    }

    const result = this.authManager.changePassword(userId, payload.oldPassword, payload.newPassword);
    if (result.success) {
      this.sendResponse(clientId, msg, { changed: true });
    } else {
      this.sendErrorToClient(clientId, msg.id, 'PASSWORD_ERROR', result.error ?? 'Failed to change password');
    }
  }

  private handleTotpStatus(clientId: string, msg: MessageEnvelope): void {
    const userId = this.clientManager.getClientUserId(clientId);
    if (!userId) {
      this.sendErrorToClient(clientId, msg.id, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    const enabled = this.authManager.isTotpEnabled(userId);
    this.sendResponse(clientId, msg, { enabled });
  }

  private handleTotpSetup(clientId: string, msg: MessageEnvelope): void {
    const userId = this.clientManager.getClientUserId(clientId);
    if (!userId) {
      this.sendErrorToClient(clientId, msg.id, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    try {
      const result = this.authManager.setupTotp(userId);
      this.sendResponse(clientId, msg, result);
    } catch (err) {
      this.sendErrorToClient(clientId, msg.id, 'TOTP_ERROR', (err as Error).message);
    }
  }

  private handleTotpEnable(clientId: string, msg: MessageEnvelope): void {
    const userId = this.clientManager.getClientUserId(clientId);
    if (!userId) {
      this.sendErrorToClient(clientId, msg.id, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    const payload = msg.payload as { code?: string };
    if (!payload.code) {
      this.sendErrorToClient(clientId, msg.id, 'INVALID_PAYLOAD', 'code required');
      return;
    }

    const enabled = this.authManager.enableTotp(userId, payload.code);
    this.sendResponse(clientId, msg, { enabled });
  }

  private handleTotpDisable(clientId: string, msg: MessageEnvelope): void {
    const userId = this.clientManager.getClientUserId(clientId);
    if (!userId) {
      this.sendErrorToClient(clientId, msg.id, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    const payload = msg.payload as { password?: string };
    if (!payload.password) {
      this.sendErrorToClient(clientId, msg.id, 'INVALID_PAYLOAD', 'password required');
      return;
    }

    const result = this.authManager.disableTotp(userId, payload.password);
    if (result.success) {
      this.sendResponse(clientId, msg, { disabled: true });
    } else {
      this.sendErrorToClient(clientId, msg.id, 'TOTP_ERROR', result.error ?? 'Failed to disable TOTP');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private sendResponse(clientId: string, originalMsg: MessageEnvelope, payload: unknown): void {
    const response = {
      id: generateMessageId(),
      type: 'response' as const,
      namespace: originalMsg.namespace,
      action: originalMsg.action,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: originalMsg.id,
      success: true,
    };
    this.clientManager.sendToClient(clientId, response);
  }

  private sendErrorToClient(clientId: string, correlationId: string, code: string, message: string): void {
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
    this.clientManager.sendToClient(clientId, response);
  }
}
