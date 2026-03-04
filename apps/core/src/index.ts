/**
 * @nexus-core/core
 *
 * NexusCore agent runtime daemon.
 * Manages projects, workspaces, AI agents, terminals, and file operations.
 */

export { CoreRuntime } from './runtime.js';
export { ProjectManager } from './managers/project-manager.js';
export { WorkspaceManager } from './managers/workspace-manager.js';
export { AgentManager } from './managers/agent-manager.js';
export { ConnectionManager } from './managers/connection-manager.js';
export { TerminalManager } from './managers/terminal-manager.js';
export { FileManager } from './managers/file-manager.js';
export { GitTracker } from './managers/git-tracker.js';
