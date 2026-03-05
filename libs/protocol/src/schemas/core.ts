/**
 * core.* namespace schemas — system info, health, configuration.
 */
import { z } from 'zod';

import { IdSchema, TimestampSchema } from './common.js';

// ─── Domain Schemas ─────────────────────────────────────────────────────────

export const CoreInfoSchema = z.object({
  coreId: IdSchema,
  displayName: z.string(),
  host: z.string(),
  port: z.number().int().positive(),
  status: z.enum(['online', 'offline', 'degraded']),
  lastHeartbeat: TimestampSchema,
});

// ─── Requests ───────────────────────────────────────────────────────────────

export const CoreInfoRequestSchema = z.object({});

export const CoreHealthRequestSchema = z.object({});

export const CoreConfigGetRequestSchema = z.object({
  key: z.string(),
});

export const CoreConfigSetRequestSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export const CoreConfigListRequestSchema = z.object({
  prefix: z.string().optional(),
});

// ─── Responses ──────────────────────────────────────────────────────────────

export const CoreInfoResponseSchema = CoreInfoSchema;

export const CoreHealthResponseSchema = z.object({
  healthy: z.boolean(),
  uptime: z.number(),
  memoryUsage: z.number(),
  activeWorkspaces: z.number().int().nonnegative(),
});

export const CoreConfigGetResponseSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export const CoreConfigSetResponseSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export const CoreConfigListResponseSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
});

// ─── Events ─────────────────────────────────────────────────────────────────

export const CoreConnectedEventSchema = z.object({
  coreId: IdSchema,
  timestamp: TimestampSchema,
});

export const CoreDisconnectedEventSchema = z.object({
  coreId: IdSchema,
  reason: z.string().optional(),
});

export const CoreErrorEventSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
