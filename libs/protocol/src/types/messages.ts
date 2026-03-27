/**
 * Inferred types from Zod schemas + per-namespace action/event maps.
 */
import type { z } from 'zod';

import type {
  // Envelope
  MessageEnvelopeSchema,
  RequestEnvelopeSchema,
  ResponseEnvelopeSchema,
  EventEnvelopeSchema,
  StreamChunkSchema,
  StreamEndSchema,
  ErrorPayloadSchema,
  // Core
  CoreInfoRequestSchema,
  CoreInfoResponseSchema,
  CoreHealthRequestSchema,
  CoreHealthResponseSchema,
  CoreBrowseRequestSchema,
  CoreBrowseResponseSchema,
  CoreConfigGetRequestSchema,
  CoreConfigGetResponseSchema,
  CoreConfigSetRequestSchema,
  CoreConfigSetResponseSchema,
  CoreConfigListRequestSchema,
  CoreConfigListResponseSchema,
  CoreConfigImportOAuthRequestSchema,
  CoreConfigImportOAuthResponseSchema,
  CoreConfigRefreshOAuthRequestSchema,
  CoreConfigRefreshOAuthResponseSchema,
  CoreConfigOAuthStatusRequestSchema,
  CoreConfigOAuthStatusResponseSchema,
  CoreConnectedEventSchema,
  CoreDisconnectedEventSchema,
  CoreErrorEventSchema,
  // Project
  ProjectListRequestSchema,
  ProjectListResponseSchema,
  ProjectCreateRequestSchema,
  ProjectCreateResponseSchema,
  ProjectDeleteRequestSchema,
  ProjectDeleteResponseSchema,
  ProjectConfigRequestSchema,
  ProjectConfigResponseSchema,
  ProjectCreatedEventSchema,
  ProjectDeletedEventSchema,
  ProjectUpdatedEventSchema,
  // Workspace
  WorkspaceCreateRequestSchema,
  WorkspaceCreateResponseSchema,
  WorkspaceListRequestSchema,
  WorkspaceListResponseSchema,
  WorkspaceEnterRequestSchema,
  WorkspaceEnterResponseSchema,
  WorkspaceSuspendRequestSchema,
  WorkspaceSuspendResponseSchema,
  WorkspaceResumeRequestSchema,
  WorkspaceResumeResponseSchema,
  WorkspaceDestroyRequestSchema,
  WorkspaceDestroyResponseSchema,
  WorkspaceCreatedEventSchema,
  WorkspaceStateChangedEventSchema,
  WorkspaceDestroyedEventSchema,
  // Agent
  AgentChatRequestSchema,
  AgentChatResponseSchema,
  AgentCancelRequestSchema,
  AgentCancelResponseSchema,
  AgentApproveRequestSchema,
  AgentApproveResponseSchema,
  AgentRejectRequestSchema,
  AgentRejectResponseSchema,
  AgentHistoryRequestSchema,
  AgentHistoryResponseSchema,
  AgentMessageEventSchema,
  AgentToolCallEventSchema,
  AgentThinkingEventSchema,
  AgentWaitingEventSchema,
  AgentCompleteEventSchema,
  // Terminal
  TerminalCreateRequestSchema,
  TerminalCreateResponseSchema,
  TerminalWriteRequestSchema,
  TerminalWriteResponseSchema,
  TerminalResizeRequestSchema,
  TerminalResizeResponseSchema,
  TerminalCloseRequestSchema,
  TerminalCloseResponseSchema,
  TerminalListRequestSchema,
  TerminalListResponseSchema,
  TerminalOutputEventSchema,
  TerminalExitEventSchema,
  TerminalCreatedEventSchema,
  // File
  FileTreeRequestSchema,
  FileTreeResponseSchema,
  FileReadRequestSchema,
  FileReadResponseSchema,
  FileWriteRequestSchema,
  FileWriteResponseSchema,
  FileSearchRequestSchema,
  FileSearchResponseSchema,
  FileWatchRequestSchema,
  FileWatchResponseSchema,
  FileChangedEventSchema,
  FileCreatedEventSchema,
  FileDeletedEventSchema,
  // Git
  GitStatusRequestSchema,
  GitStatusResponseSchema,
  GitDiffRequestSchema,
  GitDiffResponseSchema,
  GitLogRequestSchema,
  GitLogResponseSchema,
  GitStageRequestSchema,
  GitStageResponseSchema,
  GitCommitRequestSchema,
  GitCommitResponseSchema,
  GitBranchRequestSchema,
  GitBranchResponseSchema,
  GitStatusChangedEventSchema,
  GitCommittedEventSchema,
  // Maestro
  MaestroLoginRequestSchema,
  MaestroLoginResponseSchema,
  MaestroAuthRequestSchema,
  MaestroAuthResponseSchema,
  MaestroCoreRegisterRequestSchema,
  MaestroCoreRegisterResponseSchema,
  MaestroCoreRemoveRequestSchema,
  MaestroCoreRemoveResponseSchema,
  MaestroCoreRenameRequestSchema,
  MaestroCoreRenameResponseSchema,
  MaestroCoreListRequestSchema,
  MaestroCoreListResponseSchema,
  MaestroAiConfigGetRequestSchema,
  MaestroAiConfigGetResponseSchema,
  MaestroAiConfigSetRequestSchema,
  MaestroAiConfigSetResponseSchema,
  MaestroUserCreateRequestSchema,
  MaestroUserCreateResponseSchema,
  MaestroUserListRequestSchema,
  MaestroUserListResponseSchema,
  MaestroUserDeleteRequestSchema,
  MaestroUserDeleteResponseSchema,
  MaestroUserResetPasswordRequestSchema,
  MaestroUserResetPasswordResponseSchema,
  MaestroTotpSetupRequestSchema,
  MaestroTotpSetupResponseSchema,
  MaestroTotpEnableRequestSchema,
  MaestroTotpEnableResponseSchema,
  MaestroCoreOnlineEventSchema,
  MaestroCoreOfflineEventSchema,
  MaestroAiConfigUpdatedEventSchema,
} from '../schemas/index.js';

// ─── Envelope Types ─────────────────────────────────────────────────────────

export type MessageEnvelopeBase = z.infer<typeof MessageEnvelopeSchema>;
export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;
export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type StreamChunk = z.infer<typeof StreamChunkSchema>;
export type StreamEnd = z.infer<typeof StreamEndSchema>;
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

// ─── Per-Namespace Action Maps ──────────────────────────────────────────────

export interface CoreActions {
  info: {
    request: z.infer<typeof CoreInfoRequestSchema>;
    response: z.infer<typeof CoreInfoResponseSchema>;
  };
  health: {
    request: z.infer<typeof CoreHealthRequestSchema>;
    response: z.infer<typeof CoreHealthResponseSchema>;
  };
  browse: {
    request: z.infer<typeof CoreBrowseRequestSchema>;
    response: z.infer<typeof CoreBrowseResponseSchema>;
  };
  'config.get': {
    request: z.infer<typeof CoreConfigGetRequestSchema>;
    response: z.infer<typeof CoreConfigGetResponseSchema>;
  };
  'config.set': {
    request: z.infer<typeof CoreConfigSetRequestSchema>;
    response: z.infer<typeof CoreConfigSetResponseSchema>;
  };
  'config.list': {
    request: z.infer<typeof CoreConfigListRequestSchema>;
    response: z.infer<typeof CoreConfigListResponseSchema>;
  };
  'config.importOAuth': {
    request: z.infer<typeof CoreConfigImportOAuthRequestSchema>;
    response: z.infer<typeof CoreConfigImportOAuthResponseSchema>;
  };
  'config.refreshOAuth': {
    request: z.infer<typeof CoreConfigRefreshOAuthRequestSchema>;
    response: z.infer<typeof CoreConfigRefreshOAuthResponseSchema>;
  };
  'config.oauthStatus': {
    request: z.infer<typeof CoreConfigOAuthStatusRequestSchema>;
    response: z.infer<typeof CoreConfigOAuthStatusResponseSchema>;
  };
}

export interface CoreEvents {
  connected: z.infer<typeof CoreConnectedEventSchema>;
  disconnected: z.infer<typeof CoreDisconnectedEventSchema>;
  error: z.infer<typeof CoreErrorEventSchema>;
}

export interface ProjectActions {
  list: {
    request: z.infer<typeof ProjectListRequestSchema>;
    response: z.infer<typeof ProjectListResponseSchema>;
  };
  create: {
    request: z.infer<typeof ProjectCreateRequestSchema>;
    response: z.infer<typeof ProjectCreateResponseSchema>;
  };
  delete: {
    request: z.infer<typeof ProjectDeleteRequestSchema>;
    response: z.infer<typeof ProjectDeleteResponseSchema>;
  };
  config: {
    request: z.infer<typeof ProjectConfigRequestSchema>;
    response: z.infer<typeof ProjectConfigResponseSchema>;
  };
}

export interface ProjectEvents {
  created: z.infer<typeof ProjectCreatedEventSchema>;
  deleted: z.infer<typeof ProjectDeletedEventSchema>;
  updated: z.infer<typeof ProjectUpdatedEventSchema>;
}

export interface WorkspaceActions {
  create: {
    request: z.infer<typeof WorkspaceCreateRequestSchema>;
    response: z.infer<typeof WorkspaceCreateResponseSchema>;
  };
  list: {
    request: z.infer<typeof WorkspaceListRequestSchema>;
    response: z.infer<typeof WorkspaceListResponseSchema>;
  };
  enter: {
    request: z.infer<typeof WorkspaceEnterRequestSchema>;
    response: z.infer<typeof WorkspaceEnterResponseSchema>;
  };
  suspend: {
    request: z.infer<typeof WorkspaceSuspendRequestSchema>;
    response: z.infer<typeof WorkspaceSuspendResponseSchema>;
  };
  resume: {
    request: z.infer<typeof WorkspaceResumeRequestSchema>;
    response: z.infer<typeof WorkspaceResumeResponseSchema>;
  };
  destroy: {
    request: z.infer<typeof WorkspaceDestroyRequestSchema>;
    response: z.infer<typeof WorkspaceDestroyResponseSchema>;
  };
}

export interface WorkspaceEvents {
  created: z.infer<typeof WorkspaceCreatedEventSchema>;
  stateChanged: z.infer<typeof WorkspaceStateChangedEventSchema>;
  destroyed: z.infer<typeof WorkspaceDestroyedEventSchema>;
}

export interface AgentActions {
  chat: {
    request: z.infer<typeof AgentChatRequestSchema>;
    response: z.infer<typeof AgentChatResponseSchema>;
  };
  cancel: {
    request: z.infer<typeof AgentCancelRequestSchema>;
    response: z.infer<typeof AgentCancelResponseSchema>;
  };
  approve: {
    request: z.infer<typeof AgentApproveRequestSchema>;
    response: z.infer<typeof AgentApproveResponseSchema>;
  };
  reject: {
    request: z.infer<typeof AgentRejectRequestSchema>;
    response: z.infer<typeof AgentRejectResponseSchema>;
  };
  history: {
    request: z.infer<typeof AgentHistoryRequestSchema>;
    response: z.infer<typeof AgentHistoryResponseSchema>;
  };
}

export interface AgentEvents {
  message: z.infer<typeof AgentMessageEventSchema>;
  toolCall: z.infer<typeof AgentToolCallEventSchema>;
  thinking: z.infer<typeof AgentThinkingEventSchema>;
  waiting: z.infer<typeof AgentWaitingEventSchema>;
  complete: z.infer<typeof AgentCompleteEventSchema>;
}

export interface TerminalActions {
  create: {
    request: z.infer<typeof TerminalCreateRequestSchema>;
    response: z.infer<typeof TerminalCreateResponseSchema>;
  };
  write: {
    request: z.infer<typeof TerminalWriteRequestSchema>;
    response: z.infer<typeof TerminalWriteResponseSchema>;
  };
  resize: {
    request: z.infer<typeof TerminalResizeRequestSchema>;
    response: z.infer<typeof TerminalResizeResponseSchema>;
  };
  close: {
    request: z.infer<typeof TerminalCloseRequestSchema>;
    response: z.infer<typeof TerminalCloseResponseSchema>;
  };
  list: {
    request: z.infer<typeof TerminalListRequestSchema>;
    response: z.infer<typeof TerminalListResponseSchema>;
  };
}

export interface TerminalEvents {
  output: z.infer<typeof TerminalOutputEventSchema>;
  exit: z.infer<typeof TerminalExitEventSchema>;
  created: z.infer<typeof TerminalCreatedEventSchema>;
}

export interface FileActions {
  tree: {
    request: z.infer<typeof FileTreeRequestSchema>;
    response: z.infer<typeof FileTreeResponseSchema>;
  };
  read: {
    request: z.infer<typeof FileReadRequestSchema>;
    response: z.infer<typeof FileReadResponseSchema>;
  };
  write: {
    request: z.infer<typeof FileWriteRequestSchema>;
    response: z.infer<typeof FileWriteResponseSchema>;
  };
  search: {
    request: z.infer<typeof FileSearchRequestSchema>;
    response: z.infer<typeof FileSearchResponseSchema>;
  };
  watch: {
    request: z.infer<typeof FileWatchRequestSchema>;
    response: z.infer<typeof FileWatchResponseSchema>;
  };
}

export interface FileEvents {
  changed: z.infer<typeof FileChangedEventSchema>;
  created: z.infer<typeof FileCreatedEventSchema>;
  deleted: z.infer<typeof FileDeletedEventSchema>;
}

export interface GitActions {
  status: {
    request: z.infer<typeof GitStatusRequestSchema>;
    response: z.infer<typeof GitStatusResponseSchema>;
  };
  diff: {
    request: z.infer<typeof GitDiffRequestSchema>;
    response: z.infer<typeof GitDiffResponseSchema>;
  };
  log: {
    request: z.infer<typeof GitLogRequestSchema>;
    response: z.infer<typeof GitLogResponseSchema>;
  };
  stage: {
    request: z.infer<typeof GitStageRequestSchema>;
    response: z.infer<typeof GitStageResponseSchema>;
  };
  commit: {
    request: z.infer<typeof GitCommitRequestSchema>;
    response: z.infer<typeof GitCommitResponseSchema>;
  };
  branch: {
    request: z.infer<typeof GitBranchRequestSchema>;
    response: z.infer<typeof GitBranchResponseSchema>;
  };
}

export interface GitEvents {
  statusChanged: z.infer<typeof GitStatusChangedEventSchema>;
  committed: z.infer<typeof GitCommittedEventSchema>;
}

// ─── Maestro ─────────────────────────────────────────────────────────────

export interface MaestroActions {
  login: {
    request: z.infer<typeof MaestroLoginRequestSchema>;
    response: z.infer<typeof MaestroLoginResponseSchema>;
  };
  auth: {
    request: z.infer<typeof MaestroAuthRequestSchema>;
    response: z.infer<typeof MaestroAuthResponseSchema>;
  };
  'cores.register': {
    request: z.infer<typeof MaestroCoreRegisterRequestSchema>;
    response: z.infer<typeof MaestroCoreRegisterResponseSchema>;
  };
  'cores.remove': {
    request: z.infer<typeof MaestroCoreRemoveRequestSchema>;
    response: z.infer<typeof MaestroCoreRemoveResponseSchema>;
  };
  'cores.rename': {
    request: z.infer<typeof MaestroCoreRenameRequestSchema>;
    response: z.infer<typeof MaestroCoreRenameResponseSchema>;
  };
  'cores.list': {
    request: z.infer<typeof MaestroCoreListRequestSchema>;
    response: z.infer<typeof MaestroCoreListResponseSchema>;
  };
  'ai.config.get': {
    request: z.infer<typeof MaestroAiConfigGetRequestSchema>;
    response: z.infer<typeof MaestroAiConfigGetResponseSchema>;
  };
  'ai.config.set': {
    request: z.infer<typeof MaestroAiConfigSetRequestSchema>;
    response: z.infer<typeof MaestroAiConfigSetResponseSchema>;
  };
  'users.create': {
    request: z.infer<typeof MaestroUserCreateRequestSchema>;
    response: z.infer<typeof MaestroUserCreateResponseSchema>;
  };
  'users.list': {
    request: z.infer<typeof MaestroUserListRequestSchema>;
    response: z.infer<typeof MaestroUserListResponseSchema>;
  };
  'users.delete': {
    request: z.infer<typeof MaestroUserDeleteRequestSchema>;
    response: z.infer<typeof MaestroUserDeleteResponseSchema>;
  };
  'users.resetPassword': {
    request: z.infer<typeof MaestroUserResetPasswordRequestSchema>;
    response: z.infer<typeof MaestroUserResetPasswordResponseSchema>;
  };
  'totp.setup': {
    request: z.infer<typeof MaestroTotpSetupRequestSchema>;
    response: z.infer<typeof MaestroTotpSetupResponseSchema>;
  };
  'totp.enable': {
    request: z.infer<typeof MaestroTotpEnableRequestSchema>;
    response: z.infer<typeof MaestroTotpEnableResponseSchema>;
  };
}

export interface MaestroEvents {
  'core.online': z.infer<typeof MaestroCoreOnlineEventSchema>;
  'core.offline': z.infer<typeof MaestroCoreOfflineEventSchema>;
  'ai.configUpdated': z.infer<typeof MaestroAiConfigUpdatedEventSchema>;
}
