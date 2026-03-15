/**
 * Message envelope schemas — the wire format for all NexusCore communication.
 */
import { z } from 'zod';

import { IdSchema, MessageTypeSchema, NamespaceSchema, TimestampSchema } from './common.js';

// ─── Base Envelope ──────────────────────────────────────────────────────────

export const MessageEnvelopeSchema = z.object({
  id: IdSchema,
  type: MessageTypeSchema,
  namespace: NamespaceSchema,
  action: z.string().min(1),
  workspaceId: z.string().optional(),
  payload: z.unknown(),
  timestamp: TimestampSchema,
  correlationId: z.string().optional(),
});

// ─── Typed Envelope Variants ────────────────────────────────────────────────

export const RequestEnvelopeSchema = MessageEnvelopeSchema.extend({
  type: z.literal('request'),
  targetCoreId: z.string().optional(),
});

export const ResponseEnvelopeSchema = MessageEnvelopeSchema.extend({
  type: z.literal('response'),
  success: z.boolean(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});

export const EventEnvelopeSchema = MessageEnvelopeSchema.extend({
  type: z.literal('event'),
  sourceCoreId: z.string().optional(),
});

// ─── Streaming ──────────────────────────────────────────────────────────────

export const StreamChunkSchema = MessageEnvelopeSchema.extend({
  type: z.literal('stream'),
  action: z.literal('chunk'),
  payload: z.object({
    content: z.string(),
    index: z.number().int().nonnegative(),
  }),
});

export const StreamEndSchema = MessageEnvelopeSchema.extend({
  type: z.literal('stream'),
  action: z.literal('end'),
  payload: z.object({
    totalChunks: z.number().int().nonnegative(),
    finalContent: z.string().optional(),
  }),
});

// ─── Error Payload ──────────────────────────────────────────────────────────

export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
