/**
 * @condrix/protocol
 *
 * Shared message types, schemas, and protocol definitions for Condrix.
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
// existing `import type { ... } from '@condrix/protocol'` statements
// continue to work without changes.

import type { z } from 'zod';

import type {
  MessageTypeSchema,
  NamespaceSchema,
  WorkspaceStateSchema,
  AgentProviderSchema,
  PermissionModeSchema,
  GitFileStatusSchema,
  AuthScopeSchema,
  NotificationChannelSchema,
  MaestroStateSchema,
  CoreInfoSchema,
  ProjectInfoSchema,
  WorkspaceInfoSchema,
  ContentBlockSchema,
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
export type PermissionMode = z.infer<typeof PermissionModeSchema>;
export type GitFileStatus = z.infer<typeof GitFileStatusSchema>;
export type AuthScope = z.infer<typeof AuthScopeSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type MaestroState = z.infer<typeof MaestroStateSchema>;

// Domain object types
export type CoreInfo = z.infer<typeof CoreInfoSchema>;
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;
export type WorkspaceInfo = z.infer<typeof WorkspaceInfoSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;
export type TerminalInfo = z.infer<typeof TerminalInfoSchema>;
export type FileEntry = z.infer<typeof FileEntrySchema>;
export type FileChange = z.infer<typeof FileChangeSchema>;
export type GitStatusEntry = z.infer<typeof GitStatusEntrySchema>;
export type GitBranchInfo = z.infer<typeof GitBranchInfoSchema>;
export type Notification = z.infer<typeof NotificationSchema>;

// Maestro types
import type {
  MaestroLoginRequestSchema,
  MaestroLoginResponseSchema,
  MaestroAuthRequestSchema,
  MaestroAuthResponseSchema,
  MaestroCoreRegisterRequestSchema,
  MaestroCoreRegisterResponseSchema,
  MaestroCoreListResponseSchema,
  MaestroAiConfigGetResponseSchema,
  MaestroAiConfigSetRequestSchema,
  MaestroAiConfigSetResponseSchema,
  MaestroUserCreateRequestSchema,
  MaestroUserCreateResponseSchema,
  MaestroUserListResponseSchema,
  MaestroTotpSetupResponseSchema,
  MaestroCoreOnlineEventSchema,
  MaestroCoreOfflineEventSchema,
} from './schemas/index.js';

export type MaestroLoginRequest = z.infer<typeof MaestroLoginRequestSchema>;
export type MaestroLoginResponse = z.infer<typeof MaestroLoginResponseSchema>;
export type MaestroAuthRequest = z.infer<typeof MaestroAuthRequestSchema>;
export type MaestroAuthResponse = z.infer<typeof MaestroAuthResponseSchema>;
export type MaestroCoreRegisterRequest = z.infer<typeof MaestroCoreRegisterRequestSchema>;
export type MaestroCoreRegisterResponse = z.infer<typeof MaestroCoreRegisterResponseSchema>;
export type MaestroCoreListResponse = z.infer<typeof MaestroCoreListResponseSchema>;
export type MaestroAiConfigGetResponse = z.infer<typeof MaestroAiConfigGetResponseSchema>;
export type MaestroAiConfigSetRequest = z.infer<typeof MaestroAiConfigSetRequestSchema>;
export type MaestroAiConfigSetResponse = z.infer<typeof MaestroAiConfigSetResponseSchema>;
export type MaestroUserCreateRequest = z.infer<typeof MaestroUserCreateRequestSchema>;
export type MaestroUserCreateResponse = z.infer<typeof MaestroUserCreateResponseSchema>;
export type MaestroUserListResponse = z.infer<typeof MaestroUserListResponseSchema>;
export type MaestroTotpSetupResponse = z.infer<typeof MaestroTotpSetupResponseSchema>;
export type MaestroCoreOnlineEvent = z.infer<typeof MaestroCoreOnlineEventSchema>;
export type MaestroCoreOfflineEvent = z.infer<typeof MaestroCoreOfflineEventSchema>;
export type RichMessage = z.infer<typeof RichMessageSchema>;
export type MessageButton = z.infer<typeof MessageButtonSchema>;
export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>;
export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

// MessageEnvelope preserves its generic parameter
export type MessageEnvelope<T = unknown> = Omit<
  z.infer<typeof MessageEnvelopeSchema>,
  'payload'
> & {
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
