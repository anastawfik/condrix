/**
 * Maestro orchestration schemas — auth, core registration, AI config, user management.
 */
import { z } from 'zod';

import { IdSchema, NotificationChannelSchema, TimestampSchema } from './common.js';

// ─── Notification ──────────────────────────────────────────────────────────

export const NotificationSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  type: z.enum(['waiting', 'error', 'complete', 'info']),
  message: z.string(),
  channel: NotificationChannelSchema,
  status: z.enum(['pending', 'sent', 'acknowledged']),
  sentAt: TimestampSchema.optional(),
  acknowledgedAt: TimestampSchema.optional(),
});

// ─── User Authentication ───────────────────────────────────────────────────

export const MaestroLoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
  totpCode: z.string().optional(),
});

export const MaestroLoginResponseSchema = z.object({
  authenticated: z.boolean(),
  sessionToken: z.string().optional(),
  expiresAt: z.string().optional(),
  requiresTotp: z.boolean().optional(),
  user: z
    .object({
      username: z.string(),
      role: z.enum(['admin', 'user']),
    })
    .optional(),
});

export const MaestroAuthRequestSchema = z.object({
  sessionToken: z.string(),
});

export const MaestroAuthResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      username: z.string(),
      role: z.enum(['admin', 'user']),
    })
    .optional(),
});

// ─── Core Registration ─────────────────────────────────────────────────────

export const MaestroCoreAuthRequestSchema = z.object({
  coreId: z.string(),
  accessToken: z.string(),
  displayName: z.string().optional(),
  totpCode: z.string().optional(),
});

export const MaestroCoreAuthResponseSchema = z.object({
  authenticated: z.boolean(),
  maestroId: z.string().optional(),
});

export const MaestroCoreRegisterRequestSchema = z.object({
  coreId: z.string(),
  displayName: z.string(),
  accessToken: z.string(),
  tunnelUrl: z.string().optional(),
  totpSecret: z.string().optional(),
});

export const MaestroCoreRegisterResponseSchema = z.object({
  id: z.string(),
  coreId: z.string(),
  registered: z.boolean(),
});

export const MaestroCoreRemoveRequestSchema = z.object({
  id: z.string(),
});

export const MaestroCoreRemoveResponseSchema = z.object({
  id: z.string(),
  removed: z.boolean(),
});

export const MaestroCoreRenameRequestSchema = z.object({
  id: z.string(),
  displayName: z.string(),
});

export const MaestroCoreRenameResponseSchema = z.object({
  id: z.string(),
  displayName: z.string(),
});

export const MaestroCoreListRequestSchema = z.object({});

export const MaestroCoreListResponseSchema = z.object({
  cores: z.array(
    z.object({
      id: z.string(),
      coreId: z.string(),
      displayName: z.string(),
      status: z.enum(['online', 'offline']),
    }),
  ),
});

// ─── AI Configuration ──────────────────────────────────────────────────────

export const MaestroAiConfigGetRequestSchema = z.object({});

export const MaestroAiConfigGetResponseSchema = z.object({
  method: z.enum(['apikey', 'oauth']).optional(),
  apiKey: z.string().optional(),
  oauthAccessToken: z.string().optional(),
  oauthRefreshToken: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  systemPrompt: z.string().optional(),
});

export const MaestroAiConfigSetRequestSchema = z.object({
  method: z.enum(['apikey', 'oauth']).optional(),
  apiKey: z.string().optional(),
  oauthAccessToken: z.string().optional(),
  oauthRefreshToken: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  systemPrompt: z.string().optional(),
});

export const MaestroAiConfigSetResponseSchema = z.object({
  updated: z.boolean(),
  pushedToCores: z.number(),
});

// ─── User Management (Admin) ───────────────────────────────────────────────

export const MaestroUserCreateRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
  role: z.enum(['admin', 'user']),
});

export const MaestroUserCreateResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'user']),
});

export const MaestroUserListRequestSchema = z.object({});

export const MaestroUserListResponseSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      username: z.string(),
      role: z.enum(['admin', 'user']),
      totpEnabled: z.boolean(),
      createdAt: z.string(),
    }),
  ),
});

export const MaestroUserDeleteRequestSchema = z.object({
  id: z.string(),
});

export const MaestroUserDeleteResponseSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

export const MaestroUserResetPasswordRequestSchema = z.object({
  id: z.string(),
  newPassword: z.string(),
});

export const MaestroUserResetPasswordResponseSchema = z.object({
  id: z.string(),
  reset: z.boolean(),
});

export const MaestroTotpSetupRequestSchema = z.object({
  userId: z.string(),
});

export const MaestroTotpSetupResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
  qrCode: z.string(),
});

export const MaestroTotpEnableRequestSchema = z.object({
  userId: z.string(),
  code: z.string(),
});

export const MaestroTotpEnableResponseSchema = z.object({
  enabled: z.boolean(),
});

// ─── Maestro Events ────────────────────────────────────────────────────────

export const MaestroCoreOnlineEventSchema = z.object({
  id: z.string(),
  coreId: z.string(),
  displayName: z.string(),
});

export const MaestroCoreOfflineEventSchema = z.object({
  id: z.string(),
  coreId: z.string(),
  displayName: z.string(),
});

export const MaestroAiConfigUpdatedEventSchema = z.object({
  method: z.string().optional(),
  model: z.string().optional(),
  pushedToCores: z.number(),
});
