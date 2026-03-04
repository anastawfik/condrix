/**
 * terminal.* namespace schemas — terminal creation and I/O.
 */
import { z } from 'zod';

import { IdSchema } from './common.js';

// ─── Domain Schemas ─────────────────────────────────────────────────────────

export const TerminalInfoSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  shell: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  pid: z.number().int().optional(),
});

// ─── Requests ───────────────────────────────────────────────────────────────

export const TerminalCreateRequestSchema = z.object({
  workspaceId: IdSchema,
  shell: z.string().optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
});

export const TerminalWriteRequestSchema = z.object({
  terminalId: IdSchema,
  data: z.string(),
});

export const TerminalResizeRequestSchema = z.object({
  terminalId: IdSchema,
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export const TerminalCloseRequestSchema = z.object({
  terminalId: IdSchema,
});

export const TerminalListRequestSchema = z.object({
  workspaceId: IdSchema.optional(),
});

// ─── Responses ──────────────────────────────────────────────────────────────

export const TerminalCreateResponseSchema = TerminalInfoSchema;

export const TerminalWriteResponseSchema = z.object({
  written: z.boolean(),
});

export const TerminalResizeResponseSchema = z.object({
  resized: z.boolean(),
});

export const TerminalCloseResponseSchema = z.object({
  closed: z.boolean(),
});

export const TerminalListResponseSchema = z.object({
  terminals: z.array(TerminalInfoSchema),
});

// ─── Events ─────────────────────────────────────────────────────────────────

export const TerminalOutputEventSchema = z.object({
  terminalId: IdSchema,
  data: z.string(),
});

export const TerminalExitEventSchema = z.object({
  terminalId: IdSchema,
  exitCode: z.number().int(),
});

export const TerminalCreatedEventSchema = TerminalInfoSchema;
