/**
 * Type-safe message factory functions for creating protocol envelopes.
 */
import type {
  NamespaceActionMap,
  NamespaceEventMap,
  RequestPayload,
  ResponsePayload,
  EventPayload,
} from '../types/routing.js';

import { generateMessageId } from './id.js';

/** Create a typed request envelope. */
export function createRequest<
  N extends keyof NamespaceActionMap,
  A extends keyof NamespaceActionMap[N] & string,
>(
  namespace: N,
  action: A,
  payload: RequestPayload<N, A>,
  options?: { workspaceId?: string; correlationId?: string },
) {
  return {
    id: generateMessageId(),
    type: 'request' as const,
    namespace,
    action,
    payload,
    timestamp: new Date().toISOString(),
    ...options,
  };
}

/** Create a typed response envelope. */
export function createResponse<
  N extends keyof NamespaceActionMap,
  A extends keyof NamespaceActionMap[N] & string,
>(
  namespace: N,
  action: A,
  payload: ResponsePayload<N, A>,
  options: {
    correlationId: string;
    success?: boolean;
    workspaceId?: string;
    error?: { code: string; message: string; details?: unknown };
  },
) {
  return {
    id: generateMessageId(),
    type: 'response' as const,
    namespace,
    action,
    payload,
    timestamp: new Date().toISOString(),
    success: options.success ?? true,
    correlationId: options.correlationId,
    workspaceId: options.workspaceId,
    error: options.error,
  };
}

/** Create a typed event envelope. */
export function createEvent<
  N extends keyof NamespaceEventMap,
  E extends keyof NamespaceEventMap[N] & string,
>(namespace: N, event: E, payload: EventPayload<N, E>, options?: { workspaceId?: string }) {
  return {
    id: generateMessageId(),
    type: 'event' as const,
    namespace,
    action: event,
    payload,
    timestamp: new Date().toISOString(),
    ...options,
  };
}

/** Create a stream chunk envelope. */
export function createStreamChunk(
  namespace: string,
  content: string,
  index: number,
  options?: { correlationId?: string; workspaceId?: string },
) {
  return {
    id: generateMessageId(),
    type: 'stream' as const,
    namespace,
    action: 'chunk' as const,
    payload: { content, index },
    timestamp: new Date().toISOString(),
    ...options,
  };
}

/** Create a stream end envelope. */
export function createStreamEnd(
  namespace: string,
  totalChunks: number,
  options?: { correlationId?: string; workspaceId?: string; finalContent?: string },
) {
  const { finalContent, ...rest } = options ?? {};
  return {
    id: generateMessageId(),
    type: 'stream' as const,
    namespace,
    action: 'end' as const,
    payload: { totalChunks, ...(finalContent !== undefined ? { finalContent } : {}) },
    timestamp: new Date().toISOString(),
    ...rest,
  };
}
