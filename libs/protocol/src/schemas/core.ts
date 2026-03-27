/**
 * core.* namespace schemas — system info, health, configuration.
 */
import { z } from 'zod';

import { IdSchema, TimestampSchema } from './common.js';

// ─── Domain Schemas ─────────────────────────────────────────────────────────

export const HostMountSchema = z.object({
  label: z.string(),
  path: z.string(),
});

export const CoreInfoSchema = z.object({
  coreId: IdSchema,
  displayName: z.string(),
  host: z.string(),
  port: z.number().int().positive(),
  status: z.enum(['online', 'offline', 'degraded']),
  lastHeartbeat: TimestampSchema,
  containerized: z.boolean().optional(),
  hostMounts: z.array(HostMountSchema).optional(),
});

// ─── Browse ─────────────────────────────────────────────────────────────────

export const CoreBrowseRequestSchema = z.object({
  path: z.string().optional(),
  depth: z.number().int().positive().optional(),
});

export const CoreBrowseResponseSchema = z.object({
  path: z.string(),
  entries: z.array(
    z.object({
      path: z.string(),
      name: z.string(),
      type: z.enum(['file', 'directory', 'symlink']),
      size: z.number().optional(),
      modifiedAt: z.string().optional(),
    }),
  ),
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

// ─── OAuth Requests ──────────────────────────────────────────────────────────

export const CoreConfigImportOAuthRequestSchema = z.object({});

export const CoreConfigRefreshOAuthRequestSchema = z.object({});

export const CoreConfigOAuthStatusRequestSchema = z.object({});

// ─── OAuth Responses ─────────────────────────────────────────────────────────

export const CoreConfigImportOAuthResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const CoreConfigRefreshOAuthResponseSchema = z.object({
  success: z.boolean(),
  expiresAt: z.string().optional(),
});

export const CoreConfigOAuthStatusResponseSchema = z.object({
  authenticated: z.boolean(),
  method: z.enum(['oauth', 'apikey', 'none']),
  expiresAt: z.string().optional(),
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
