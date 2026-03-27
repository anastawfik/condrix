/**
 * Routes namespace:action pairs to handler functions.
 * Parses incoming WebSocket messages and dispatches to registered handlers.
 */
import { safeParseMessage, isRequest } from '@condrix/protocol';
import type { MessageEnvelope } from '@condrix/protocol';

export type RouteHandler = (payload: unknown, envelope: MessageEnvelope) => Promise<unknown>;

export type ReplySender = (response: unknown) => void;

export class MessageRouter {
  private handlers = new Map<string, RouteHandler>();

  register(namespace: string, action: string, handler: RouteHandler): void {
    const key = `${namespace}:${action}`;
    this.handlers.set(key, handler);
  }

  has(namespace: string, action: string): boolean {
    return this.handlers.has(`${namespace}:${action}`);
  }

  async dispatch(raw: string, reply: ReplySender): Promise<void> {
    // Parse
    const result = safeParseMessage(raw);
    if (!result.success) {
      reply({
        id: '',
        type: 'response',
        namespace: 'core',
        action: 'error',
        payload: {},
        timestamp: new Date().toISOString(),
        success: false,
        error: { code: 'INVALID_MESSAGE', message: 'Failed to parse message' },
      });
      return;
    }

    const envelope = result.data as MessageEnvelope;

    // Only route requests
    if (!isRequest(envelope)) {
      return;
    }

    const key = `${envelope.namespace}:${envelope.action}`;
    const handler = this.handlers.get(key);

    if (!handler) {
      reply({
        id: '',
        type: 'response',
        namespace: envelope.namespace,
        action: envelope.action,
        payload: {},
        timestamp: new Date().toISOString(),
        correlationId: envelope.id,
        success: false,
        error: { code: 'UNKNOWN_ACTION', message: `No handler for ${key}` },
      });
      return;
    }

    try {
      const responsePayload = await handler(envelope.payload, envelope);
      reply({
        id: '',
        type: 'response',
        namespace: envelope.namespace,
        action: envelope.action,
        payload: responsePayload,
        timestamp: new Date().toISOString(),
        correlationId: envelope.id,
        success: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      reply({
        id: '',
        type: 'response',
        namespace: envelope.namespace,
        action: envelope.action,
        payload: {},
        timestamp: new Date().toISOString(),
        correlationId: envelope.id,
        success: false,
        error: { code: 'HANDLER_ERROR', message },
      });
    }
  }
}
