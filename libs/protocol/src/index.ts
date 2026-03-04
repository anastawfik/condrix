/**
 * @nexus-core/protocol
 *
 * Shared message types, schemas, and protocol definitions for NexusCore.
 * All communication between Cores, Clients, and Maestro uses these types.
 */

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export * from './schemas/index.js';

// ─── Typed Action/Event Maps & Routing ──────────────────────────────────────

export * from './types/index.js';

// ─── Runtime Helpers ────────────────────────────────────────────────────────

export * from './helpers/index.js';

// ─── Backwards-Compatible Inferred Types ────────────────────────────────────
// These preserve the original type names from the flat index.ts so that all
// existing `import type { ... } from '@nexus-core/protocol'` statements
// continue to work without changes.

import type { z } from 'zod';

import type {
  MessageTypeSchema,
  NamespaceSchema,
  WorkspaceStateSchema,
  AgentProviderSchema,
  GitFileStatusSchema,
  AuthScopeSchema,
  NotificationChannelSchema,
  MaestroStateSchema,
  CoreInfoSchema,
  ProjectInfoSchema,
  WorkspaceInfoSchema,
  AgentMessageSchema,
  AgentToolCallSchema,
  TerminalInfoSchema,
  FileEntrySchema,
  FileChangeSchema,
  GitStatusEntrySchema,
  GitBranchInfoSchema,
  NotificationSchema,
  RichMessageSchema,
  MessageButtonSchema,
  MessageAttachmentSchema,
  IncomingMessageSchema,
  AuthTokenSchema,
  SkillDefinitionSchema,
  McpServerConfigSchema,
  MessageEnvelopeSchema,
} from './schemas/index.js';

// Enum / union types
export type MessageType = z.infer<typeof MessageTypeSchema>;
export type Namespace = z.infer<typeof NamespaceSchema>;
export type WorkspaceState = z.infer<typeof WorkspaceStateSchema>;
export type AgentProvider = z.infer<typeof AgentProviderSchema>;
export type GitFileStatus = z.infer<typeof GitFileStatusSchema>;
export type AuthScope = z.infer<typeof AuthScopeSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type MaestroState = z.infer<typeof MaestroStateSchema>;

// Domain object types
export type CoreInfo = z.infer<typeof CoreInfoSchema>;
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;
export type WorkspaceInfo = z.infer<typeof WorkspaceInfoSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;
export type TerminalInfo = z.infer<typeof TerminalInfoSchema>;
export type FileEntry = z.infer<typeof FileEntrySchema>;
export type FileChange = z.infer<typeof FileChangeSchema>;
export type GitStatusEntry = z.infer<typeof GitStatusEntrySchema>;
export type GitBranchInfo = z.infer<typeof GitBranchInfoSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type RichMessage = z.infer<typeof RichMessageSchema>;
export type MessageButton = z.infer<typeof MessageButtonSchema>;
export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>;
export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

// MessageEnvelope preserves its generic parameter
export type MessageEnvelope<T = unknown> = Omit<z.infer<typeof MessageEnvelopeSchema>, 'payload'> & {
  payload: T;
};

// ─── Message Adapter Interface ──────────────────────────────────────────────
// Kept as a hand-written interface (methods with Promise returns can't be Zod schemas)

export interface MessageAdapter {
  connect(): Promise<void>;
  sendText(chatId: string, text: string): Promise<void>;
  sendRichMessage(chatId: string, msg: RichMessage): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => void): void;
  disconnect(): Promise<void>;
}
