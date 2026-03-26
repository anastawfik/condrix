/**
 * @condrix/client-shared
 *
 * Shared React components, hooks, stores, and utilities used across
 * Desktop, Web, and Mobile Condrix clients.
 */

// Stores (vanilla Zustand — usable outside React)
export { connectionStore, createConnectionStore } from './stores/connection-store.js';
export { coreRegistryStore, createCoreRegistryStore } from './stores/core-registry-store.js';
export { multiCoreStore, createMultiCoreStore } from './stores/multi-core-store.js';
export { workspaceStore, createWorkspaceStore, getSavedUIState, initWorkspaceSync } from './stores/workspace-store.js';
export { chatStore, createChatStore, initChatSync } from './stores/chat-store.js';
export { fileStore, createFileStore } from './stores/file-store.js';
export { terminalStore, createTerminalStore, initTerminalSync } from './stores/terminal-store.js';
export { gitStore, createGitStore } from './stores/git-store.js';
export { settingsStore, createSettingsStore } from './stores/settings-store.js';
export { maestroStore, createMaestroStore } from './stores/maestro-store.js';

// Context
export { CoreConnectionProvider, useConnection, useConnectionActions } from './context/core-connection-context.js';

// Hooks
export { useCoreConnection } from './hooks/use-core-connection.js';
export { useWorkspace } from './hooks/use-workspace.js';
export { useFileTree } from './hooks/use-file-tree.js';
export { useFileContent } from './hooks/use-file-content.js';
export { useTerminals } from './hooks/use-terminals.js';
export { useGitStatus } from './hooks/use-git-status.js';
export { useSettings } from './hooks/use-settings.js';
export { useWorkspaceConfig } from './hooks/use-workspace-config.js';

// Types
export type { ConnectionState, ConnectionConfig, ConnectionStore } from './stores/connection-store.js';
export type { CoreEntry, CoreRegistryStore } from './stores/core-registry-store.js';
export type { CoreConnection, MultiCoreStore } from './stores/multi-core-store.js';
export type { WorkspaceStore } from './stores/workspace-store.js';
export type { ChatMessage, ToolCall, ChatStore } from './stores/chat-store.js';
export type { FileNode, OpenFile, FileStore } from './stores/file-store.js';
export type { TerminalSession, TerminalStore } from './stores/terminal-store.js';
export type { GitFileChange, DiffTab, GitStore } from './stores/git-store.js';
export type { SettingsStore } from './stores/settings-store.js';
export type { MaestroStore, MaestroUser, MaestroCore, MaestroConnectionState } from './stores/maestro-store.js';
export type { UseCoreConnectionReturn, ConnectionOptions } from './hooks/use-core-connection.js';
export type { UseWorkspaceReturn } from './hooks/use-workspace.js';
export type { UseFileTreeReturn } from './hooks/use-file-tree.js';
export type { UseFileContentReturn } from './hooks/use-file-content.js';
export type { UseTerminalsReturn } from './hooks/use-terminals.js';
export type { UseGitStatusReturn } from './hooks/use-git-status.js';
export type { UseSettingsReturn } from './hooks/use-settings.js';
export type { WorkspaceConfig, UseWorkspaceConfigReturn } from './hooks/use-workspace-config.js';
