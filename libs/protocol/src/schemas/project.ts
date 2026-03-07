/**
 * project.* namespace schemas — project CRUD and configuration.
 */
import { z } from 'zod';

import { IdSchema, WorkspaceStateSchema } from './common.js';

// ─── Domain Schemas ─────────────────────────────────────────────────────────

export const WorkspaceInfoSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: z.string(),
  state: WorkspaceStateSchema,
  branch: z.string().optional(),
  agentProvider: z.string().optional(),
  workDir: z.string().optional(),
});

export const ProjectInfoSchema = z.object({
  id: IdSchema,
  name: z.string(),
  path: z.string(),
  url: z.string().optional(),
  workspaces: z.array(WorkspaceInfoSchema),
});

// ─── Requests ───────────────────────────────────────────────────────────────

export const ProjectListRequestSchema = z.object({});

export const ProjectCreateRequestSchema = z.object({
  name: z.string().min(1),
  path: z.string().optional(),
  url: z.string().optional(),
});

export const ProjectDeleteRequestSchema = z.object({
  projectId: IdSchema,
});

export const ProjectConfigRequestSchema = z.object({
  projectId: IdSchema,
  key: z.string().optional(),
  value: z.unknown().optional(),
});

// ─── Responses ──────────────────────────────────────────────────────────────

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectInfoSchema),
});

export const ProjectCreateResponseSchema = ProjectInfoSchema;

export const ProjectDeleteResponseSchema = z.object({
  projectId: IdSchema,
  deleted: z.boolean(),
});

export const ProjectConfigResponseSchema = z.object({
  projectId: IdSchema,
  config: z.record(z.unknown()),
});

// ─── Events ─────────────────────────────────────────────────────────────────

export const ProjectCreatedEventSchema = ProjectInfoSchema;

export const ProjectDeletedEventSchema = z.object({
  projectId: IdSchema,
});

export const ProjectUpdatedEventSchema = ProjectInfoSchema;
