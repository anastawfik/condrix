/**
 * Runtime message validation and type guards.
 */
import type { z } from 'zod';

import {
  MessageEnvelopeSchema,
  RequestEnvelopeSchema,
  ResponseEnvelopeSchema,
  EventEnvelopeSchema,
  StreamChunkSchema,
  StreamEndSchema,
} from '../schemas/envelope.js';

type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;
type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;
type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;
type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
type StreamChunk = z.infer<typeof StreamChunkSchema>;
type StreamEnd = z.infer<typeof StreamEndSchema>;

/**
 * Validate a message envelope (throws on failure).
 * Parses from unknown input (string or object) and returns a typed envelope.
 */
export function validateMessage(input: unknown): MessageEnvelope {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  return MessageEnvelopeSchema.parse(data);
}

/**
 * Parse a message envelope (throws on failure). Alias for validateMessage.
 */
export function parseMessage(input: unknown): MessageEnvelope {
  return validateMessage(input);
}

/**
 * Safely parse a message envelope (returns Zod SafeParseResult, never throws).
 */
export function safeParseMessage(input: unknown) {
  try {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    return MessageEnvelopeSchema.safeParse(data);
  } catch {
    return {
      success: false as const,
      error: new // We need a ZodError-like object for the JSON.parse failure case
      (class {
        issues = [{ code: 'custom', message: 'Invalid JSON input', path: [] }];
      })(),
    };
  }
}

// ─── Type Guards ────────────────────────────────────────────────────────────

/** Check if a message is a request. */
export function isRequest(msg: MessageEnvelope): msg is RequestEnvelope {
  return msg.type === 'request';
}

/** Check if a message is a response. */
export function isResponse(msg: MessageEnvelope): msg is ResponseEnvelope {
  return msg.type === 'response';
}

/** Check if a message is an event. */
export function isEvent(msg: MessageEnvelope): msg is EventEnvelope {
  return msg.type === 'event';
}

/** Check if a message is a stream chunk or stream end. */
export function isStream(msg: MessageEnvelope): msg is StreamChunk | StreamEnd {
  return msg.type === 'stream';
}

/** Check if a message is a stream chunk. */
export function isStreamChunk(msg: MessageEnvelope): msg is StreamChunk {
  return msg.type === 'stream' && msg.action === 'chunk';
}

/** Check if a message is a stream end. */
export function isStreamEnd(msg: MessageEnvelope): msg is StreamEnd {
  return msg.type === 'stream' && msg.action === 'end';
}
