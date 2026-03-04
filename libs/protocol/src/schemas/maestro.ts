/**
 * Maestro notification schema.
 */
import { z } from 'zod';

import { IdSchema, NotificationChannelSchema, TimestampSchema } from './common.js';

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
