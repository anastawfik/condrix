/**
 * file.* namespace schemas — file tree, read/write, search, watch.
 */
import { z } from 'zod';

import { IdSchema, TimestampSchema } from './common.js';

// ─── Domain Schemas ─────────────────────────────────────────────────────────

export const FileEntrySchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.enum(['file', 'directory', 'symlink']),
  size: z.number().optional(),
  modifiedAt: TimestampSchema.optional(),
});

export const FileChangeSchema = z.object({
  path: z.string(),
  type: z.enum(['created', 'modified', 'deleted', 'renamed']),
  oldPath: z.string().optional(),
});

// ─── Requests ───────────────────────────────────────────────────────────────

export const FileTreeRequestSchema = z.object({
  workspaceId: IdSchema,
  path: z.string().optional(),
  depth: z.number().int().positive().optional(),
});

export const FileReadRequestSchema = z.object({
  workspaceId: IdSchema,
  path: z.string(),
  encoding: z.string().optional(),
});

export const FileWriteRequestSchema = z.object({
  workspaceId: IdSchema,
  path: z.string(),
  content: z.string(),
  createDirs: z.boolean().optional(),
});

export const FileSearchRequestSchema = z.object({
  workspaceId: IdSchema,
  pattern: z.string(),
  path: z.string().optional(),
  maxResults: z.number().int().positive().optional(),
});

export const FileWatchRequestSchema = z.object({
  workspaceId: IdSchema,
  paths: z.array(z.string()),
});

// ─── Responses ──────────────────────────────────────────────────────────────

export const FileTreeResponseSchema = z.object({
  entries: z.array(FileEntrySchema),
});

export const FileReadResponseSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.string(),
});

export const FileWriteResponseSchema = z.object({
  path: z.string(),
  written: z.boolean(),
});

export const FileSearchResponseSchema = z.object({
  matches: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().optional(),
      content: z.string().optional(),
    }),
  ),
});

export const FileWatchResponseSchema = z.object({
  watching: z.boolean(),
  paths: z.array(z.string()),
});

// ─── Events ─────────────────────────────────────────────────────────────────

export const FileChangedEventSchema = FileChangeSchema.extend({
  workspaceId: IdSchema,
});

export const FileCreatedEventSchema = z.object({
  workspaceId: IdSchema,
  path: z.string(),
  type: z.enum(['file', 'directory']),
});

export const FileDeletedEventSchema = z.object({
  workspaceId: IdSchema,
  path: z.string(),
});
