/**
 * agent.* namespace schemas — AI agent interaction and streaming.
 */
import { z } from 'zod';

import { IdSchema, TimestampSchema } from './common.js';

// ─── Domain Schemas ─────────────────────────────────────────────────────────

export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: TimestampSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const AgentToolCallSchema = z.object({
  id: IdSchema,
  name: z.string(),
  arguments: z.record(z.unknown()),
  result: z.unknown().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
});

// ─── Requests ───────────────────────────────────────────────────────────────

export const AgentChatRequestSchema = z.object({
  workspaceId: IdSchema,
  message: z.string().min(1),
  stream: z.boolean().optional(),
});

export const AgentCancelRequestSchema = z.object({
  workspaceId: IdSchema,
});

export const AgentApproveRequestSchema = z.object({
  workspaceId: IdSchema,
  toolCallId: IdSchema,
});

export const AgentRejectRequestSchema = z.object({
  workspaceId: IdSchema,
  toolCallId: IdSchema,
  reason: z.string().optional(),
});

export const AgentHistoryRequestSchema = z.object({
  workspaceId: IdSchema,
  limit: z.number().int().positive().optional(),
  before: TimestampSchema.optional(),
});

// ─── Responses ──────────────────────────────────────────────────────────────

export const AgentChatResponseSchema = z.object({
  messageId: IdSchema,
  content: z.string(),
  toolCalls: z.array(AgentToolCallSchema).optional(),
});

export const AgentCancelResponseSchema = z.object({
  cancelled: z.boolean(),
});

export const AgentApproveResponseSchema = z.object({
  toolCallId: IdSchema,
  approved: z.boolean(),
});

export const AgentRejectResponseSchema = z.object({
  toolCallId: IdSchema,
  rejected: z.boolean(),
});

export const AgentHistoryResponseSchema = z.object({
  messages: z.array(AgentMessageSchema),
  hasMore: z.boolean(),
});

// ─── Events ─────────────────────────────────────────────────────────────────

export const AgentMessageEventSchema = AgentMessageSchema;

export const AgentToolCallEventSchema = AgentToolCallSchema;

export const AgentThinkingEventSchema = z.object({
  workspaceId: IdSchema,
  thinking: z.boolean(),
});

export const AgentWaitingEventSchema = z.object({
  workspaceId: IdSchema,
  toolCallId: IdSchema,
  toolName: z.string(),
  description: z.string().optional(),
});

export const AgentCompleteEventSchema = z.object({
  workspaceId: IdSchema,
  messageId: IdSchema,
  content: z.string(),
});
