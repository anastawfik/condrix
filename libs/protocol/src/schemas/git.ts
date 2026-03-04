/**
 * git.* namespace schemas — git operations and status tracking.
 */
import { z } from 'zod';

import { GitFileStatusSchema, IdSchema, TimestampSchema } from './common.js';

// ─── Domain Schemas ─────────────────────────────────────────────────────────

export const GitStatusEntrySchema = z.object({
  path: z.string(),
  status: GitFileStatusSchema,
  staged: z.boolean(),
});

export const GitBranchInfoSchema = z.object({
  name: z.string(),
  current: z.boolean(),
  remote: z.string().optional(),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
});

// ─── Requests ───────────────────────────────────────────────────────────────

export const GitStatusRequestSchema = z.object({
  workspaceId: IdSchema,
});

export const GitDiffRequestSchema = z.object({
  workspaceId: IdSchema,
  staged: z.boolean().optional(),
  path: z.string().optional(),
});

export const GitLogRequestSchema = z.object({
  workspaceId: IdSchema,
  limit: z.number().int().positive().optional(),
  branch: z.string().optional(),
});

export const GitStageRequestSchema = z.object({
  workspaceId: IdSchema,
  paths: z.array(z.string()),
});

export const GitCommitRequestSchema = z.object({
  workspaceId: IdSchema,
  message: z.string().min(1),
});

export const GitBranchRequestSchema = z.object({
  workspaceId: IdSchema,
  name: z.string().optional(),
  checkout: z.boolean().optional(),
  delete: z.boolean().optional(),
});

// ─── Responses ──────────────────────────────────────────────────────────────

export const GitStatusResponseSchema = z.object({
  entries: z.array(GitStatusEntrySchema),
  branch: z.string(),
  clean: z.boolean(),
});

export const GitDiffResponseSchema = z.object({
  diff: z.string(),
  files: z.array(z.string()),
});

export const GitLogResponseSchema = z.object({
  commits: z.array(
    z.object({
      hash: z.string(),
      message: z.string(),
      author: z.string(),
      date: TimestampSchema,
    }),
  ),
});

export const GitStageResponseSchema = z.object({
  staged: z.array(z.string()),
});

export const GitCommitResponseSchema = z.object({
  hash: z.string(),
  message: z.string(),
});

export const GitBranchResponseSchema = z.object({
  branches: z.array(GitBranchInfoSchema),
  current: z.string(),
});

// ─── Events ─────────────────────────────────────────────────────────────────

export const GitStatusChangedEventSchema = z.object({
  workspaceId: IdSchema,
  entries: z.array(GitStatusEntrySchema),
  branch: z.string(),
});

export const GitCommittedEventSchema = z.object({
  workspaceId: IdSchema,
  hash: z.string(),
  message: z.string(),
});
