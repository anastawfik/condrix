/**
 * Shared enums and primitive schemas used across all namespaces.
 */
import { z } from 'zod';

// ─── Message Primitives ─────────────────────────────────────────────────────

export const MessageTypeSchema = z.enum(['request', 'response', 'event', 'stream']);

export const NamespaceSchema = z.enum([
  'core',
  'project',
  'workspace',
  'agent',
  'terminal',
  'file',
  'git',
]);

// ─── ID Primitives ──────────────────────────────────────────────────────────

export const IdSchema = z.string().min(1);
export const TimestampSchema = z.string(); // ISO 8601

// ─── Workspace ──────────────────────────────────────────────────────────────

export const WorkspaceStateSchema = z.enum([
  'CREATING',
  'IDLE',
  'ACTIVE',
  'WAITING',
  'SUSPENDED',
  'ERRORED',
  'DESTROYED',
]);

// ─── Agent ──────────────────────────────────────────────────────────────────

export const AgentProviderSchema = z.enum(['claude', 'openai', 'local', 'custom']);

// ─── Git ────────────────────────────────────────────────────────────────────

export const GitFileStatusSchema = z.enum([
  'modified',
  'added',
  'deleted',
  'renamed',
  'untracked',
]);

// ─── Auth ───────────────────────────────────────────────────────────────────

export const AuthScopeSchema = z.enum([
  'read:files',
  'write:files',
  'exec:terminal',
  'admin:workspace',
  'admin:project',
  'admin:core',
  'chat:agent',
  'chat:maestro',
]);

// ─── Notification / Maestro ─────────────────────────────────────────────────

export const NotificationChannelSchema = z.enum(['whatsapp', 'telegram', 'push', 'web']);

export const MaestroStateSchema = z.enum(['INITIALIZING', 'ACTIVE', 'DEGRADED', 'RECOVERING']);
