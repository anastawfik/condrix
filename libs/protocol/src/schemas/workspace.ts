/**
 * workspace.* namespace schemas — workspace lifecycle management.
 */
import { z } from 'zod';

import { AgentProviderSchema, IdSchema, WorkspaceStateSchema } from './common.js';

import { WorkspaceInfoSchema } from './project.js';

// Re-export for convenience
export { WorkspaceInfoSchema };

// ─── Requests ───────────────────────────────────────────────────────────────

export const WorkspaceCreateRequestSchema = z.object({
  projectId: IdSchema,
  name: z.string().min(1),
  branch: z.string().optional(),
  agentProvider: AgentProviderSchema.optional(),
});

export const WorkspaceListRequestSchema = z.object({
  projectId: IdSchema.optional(),
});

export const WorkspaceEnterRequestSchema = z.object({
  workspaceId: IdSchema,
});

export const WorkspaceSuspendRequestSchema = z.object({
  workspaceId: IdSchema,
});

export const WorkspaceResumeRequestSchema = z.object({
  workspaceId: IdSchema,
});

export const WorkspaceDestroyRequestSchema = z.object({
  workspaceId: IdSchema,
});

// ─── Responses ──────────────────────────────────────────────────────────────

export const WorkspaceCreateResponseSchema = WorkspaceInfoSchema;

export const WorkspaceListResponseSchema = z.object({
  workspaces: z.array(WorkspaceInfoSchema),
});

export const WorkspaceEnterResponseSchema = WorkspaceInfoSchema;

export const WorkspaceSuspendResponseSchema = z.object({
  workspaceId: IdSchema,
  state: WorkspaceStateSchema,
});

export const WorkspaceResumeResponseSchema = WorkspaceInfoSchema;

export const WorkspaceDestroyResponseSchema = z.object({
  workspaceId: IdSchema,
  destroyed: z.boolean(),
});

// ─── Events ─────────────────────────────────────────────────────────────────

export const WorkspaceCreatedEventSchema = WorkspaceInfoSchema;

export const WorkspaceStateChangedEventSchema = z.object({
  workspaceId: IdSchema,
  previousState: WorkspaceStateSchema,
  newState: WorkspaceStateSchema,
});

export const WorkspaceDestroyedEventSchema = z.object({
  workspaceId: IdSchema,
});
