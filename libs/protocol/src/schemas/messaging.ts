/**
 * Rich messaging schemas — buttons, attachments, incoming messages.
 */
import { z } from 'zod';

import { TimestampSchema } from './common.js';

export const MessageButtonSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
});

export const MessageAttachmentSchema = z.object({
  type: z.enum(['file', 'image', 'code']),
  name: z.string(),
  content: z.union([z.string(), z.instanceof(Uint8Array)]),
  mimeType: z.string().optional(),
});

export const RichMessageSchema = z.object({
  text: z.string(),
  buttons: z.array(MessageButtonSchema).optional(),
  codeBlock: z.string().optional(),
  attachments: z.array(MessageAttachmentSchema).optional(),
});

export const IncomingMessageSchema = z.object({
  chatId: z.string(),
  senderId: z.string(),
  text: z.string(),
  platform: z.enum(['whatsapp', 'telegram']),
  timestamp: TimestampSchema,
  replyTo: z.string().optional(),
});
