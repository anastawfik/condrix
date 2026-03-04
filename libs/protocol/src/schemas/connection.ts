/**
 * Connection lifecycle schemas — auth, state sync, subscriptions, heartbeat.
 */
import { z } from 'zod';

import { AuthScopeSchema, IdSchema, TimestampSchema } from './common.js';

// ─── Domain Schemas ─────────────────────────────────────────────────────────

export const AuthTokenSchema = z.object({
  token: z.string(),
  scopes: z.array(AuthScopeSchema),
  expiresAt: TimestampSchema.optional(),
});

// ─── Auth ───────────────────────────────────────────────────────────────────

export const AuthRequestSchema = z.object({
  token: z.string(),
  clientId: IdSchema.optional(),
  clientType: z.enum(['desktop', 'web', 'mobile', 'cli']).optional(),
});

export const AuthResponseSchema = z.object({
  authenticated: z.boolean(),
  scopes: z.array(AuthScopeSchema),
  sessionId: IdSchema.optional(),
});

// ─── State Sync ─────────────────────────────────────────────────────────────

export const StateSyncRequestSchema = z.object({
  lastSyncTimestamp: TimestampSchema.optional(),
});

export const StateSyncResponseSchema = z.object({
  timestamp: TimestampSchema,
  state: z.record(z.unknown()),
});

// ─── Event Subscription ─────────────────────────────────────────────────────

export const EventSubscriptionRequestSchema = z.object({
  subscribe: z.array(z.string()),
  unsubscribe: z.array(z.string()).optional(),
});

export const EventSubscriptionResponseSchema = z.object({
  subscribed: z.array(z.string()),
});

// ─── Heartbeat ──────────────────────────────────────────────────────────────

export const HeartbeatRequestSchema = z.object({
  timestamp: TimestampSchema,
});

export const HeartbeatResponseSchema = z.object({
  timestamp: TimestampSchema,
  serverTime: TimestampSchema,
});
