/**
 * @nexus-core/core
 *
 * NexusCore agent runtime daemon.
 * Manages projects, workspaces, AI agents, terminals, and file operations.
 */

export { CoreRuntime } from './runtime.js';
export type { CoreConfig } from './runtime.js';
export { CoreDatabase } from './database.js';
export type { CoreDatabaseOptions } from './database.js';
export { MessageRouter } from './message-router.js';
export type { RouteHandler, ReplySender } from './message-router.js';
export { ProjectManager } from './managers/project-manager.js';
export { WorkspaceManager } from './managers/workspace-manager.js';
export { AgentManager, EchoProvider } from './managers/agent-manager.js';
export type { AgentProviderAdapter } from './managers/agent-manager.js';
export { ConnectionManager } from './managers/connection-manager.js';
export type { ClientSession } from './managers/connection-manager.js';
export { TerminalManager } from './managers/terminal-manager.js';
export { FileManager } from './managers/file-manager.js';
export { GitTracker } from './managers/git-tracker.js';
