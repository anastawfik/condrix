/**
 * @nexus-core/protocol
 *
 * Shared message types, schemas, and protocol definitions for NexusCore.
 * All communication between Cores, Clients, and Maestro uses these types.
 */

// ─── Message Envelope ────────────────────────────────────────────────────────

export type MessageType = 'request' | 'response' | 'event' | 'stream';

export type Namespace = 'core' | 'project' | 'workspace' | 'agent' | 'terminal' | 'file' | 'git';

export interface MessageEnvelope<T = unknown> {
  id: string;
  type: MessageType;
  namespace: Namespace;
  action: string;
  workspaceId?: string;
  payload: T;
  timestamp: string;
  correlationId?: string;
}

// ─── Workspace States ────────────────────────────────────────────────────────

export type WorkspaceState =
  | 'CREATING'
  | 'IDLE'
  | 'ACTIVE'
  | 'WAITING'
  | 'SUSPENDED'
  | 'ERRORED'
  | 'DESTROYED';

// ─── Core Types ──────────────────────────────────────────────────────────────

export interface CoreInfo {
  coreId: string;
  displayName: string;
  host: string;
  port: number;
  status: 'online' | 'offline' | 'degraded';
  lastHeartbeat: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  workspaces: WorkspaceInfo[];
}

export interface WorkspaceInfo {
  id: string;
  projectId: string;
  name: string;
  state: WorkspaceState;
  branch?: string;
  agentProvider?: string;
}

// ─── Agent Types ─────────────────────────────────────────────────────────────

export type AgentProvider = 'claude' | 'openai' | 'local' | 'custom';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ─── Terminal Types ──────────────────────────────────────────────────────────

export interface TerminalInfo {
  id: string;
  workspaceId: string;
  shell: string;
  cols: number;
  rows: number;
  pid?: number;
}

// ─── File Types ──────────────────────────────────────────────────────────────

export interface FileEntry {
  path: string;
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  modifiedAt?: string;
}

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
}

// ─── Git Types ───────────────────────────────────────────────────────────────

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';

export interface GitStatusEntry {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  remote?: string;
  ahead: number;
  behind: number;
}

// ─── Maestro Types ───────────────────────────────────────────────────────────

export type MaestroState = 'INITIALIZING' | 'ACTIVE' | 'DEGRADED' | 'RECOVERING';

export type NotificationChannel = 'whatsapp' | 'telegram' | 'push' | 'web';

export interface Notification {
  id: string;
  workspaceId: string;
  type: 'waiting' | 'error' | 'complete' | 'info';
  message: string;
  channel: NotificationChannel;
  status: 'pending' | 'sent' | 'acknowledged';
  sentAt?: string;
  acknowledgedAt?: string;
}

// ─── Messaging Types ─────────────────────────────────────────────────────────

export interface RichMessage {
  text: string;
  buttons?: MessageButton[];
  codeBlock?: string;
  attachments?: MessageAttachment[];
}

export interface MessageButton {
  id: string;
  label: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface MessageAttachment {
  type: 'file' | 'image' | 'code';
  name: string;
  content: string | Buffer;
  mimeType?: string;
}

export interface IncomingMessage {
  chatId: string;
  senderId: string;
  text: string;
  platform: 'whatsapp' | 'telegram';
  timestamp: string;
  replyTo?: string;
}

// ─── Auth Types ──────────────────────────────────────────────────────────────

export type AuthScope =
  | 'read:files'
  | 'write:files'
  | 'exec:terminal'
  | 'admin:workspace'
  | 'admin:project'
  | 'admin:core'
  | 'chat:agent'
  | 'chat:maestro';

export interface AuthToken {
  token: string;
  scopes: AuthScope[];
  expiresAt?: string;
}

// ─── Skill Types ─────────────────────────────────────────────────────────────

export interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  systemPromptFile: string;
  tools: string[];
  mcpServers?: string[];
  config?: Record<string, unknown>;
}

// ─── MCP Types ───────────────────────────────────────────────────────────────

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  scope: 'global' | 'project' | 'workspace';
}

// ─── Message Adapter Interface ───────────────────────────────────────────────

export interface MessageAdapter {
  connect(): Promise<void>;
  sendText(chatId: string, text: string): Promise<void>;
  sendRichMessage(chatId: string, msg: RichMessage): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => void): void;
  disconnect(): Promise<void>;
}
