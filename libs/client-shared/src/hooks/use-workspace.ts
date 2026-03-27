/**
 * React hook for workspace state and agent interactions.
 * Thin wrapper around workspace and chat Zustand stores.
 */
import { useStore } from 'zustand';
import { useEffect } from 'react';
import type { WorkspaceInfo, ProjectInfo } from '@condrix/protocol';

import { workspaceStore } from '../stores/workspace-store.js';
import { multiCoreStore } from '../stores/multi-core-store.js';
import { chatStore, type ChatMessage } from '../stores/chat-store.js';

export interface UseWorkspaceReturn {
  workspace: WorkspaceInfo | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (message: string) => Promise<void>;
  approveAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string) => Promise<void>;
  // Project management
  projects: ProjectInfo[];
  currentProjectId: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, opts: { path?: string; url?: string }) => Promise<ProjectInfo>;
  deleteProject: (projectId: string) => Promise<void>;
  setCurrentProject: (projectId: string | null) => void;
  // Workspace management
  workspaces: WorkspaceInfo[];
  fetchWorkspaces: (projectId?: string) => Promise<void>;
  createWorkspace: (projectId: string, name: string, branch?: string) => Promise<WorkspaceInfo>;
  enterWorkspace: (workspaceId: string) => Promise<void>;
  suspendWorkspace: (workspaceId: string) => Promise<void>;
  resumeWorkspace: (workspaceId: string) => Promise<void>;
  destroyWorkspace: (workspaceId: string) => Promise<void>;
}

const EMPTY_MESSAGES: ChatMessage[] = [];

export function useWorkspace(workspaceId: string | null): UseWorkspaceReturn {
  const workspace = useStore(workspaceStore, (s) => s.currentWorkspace);
  const messages = useStore(chatStore, (s) =>
    workspaceId ? (s.messages.get(workspaceId) ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const isStreaming = useStore(chatStore, (s) =>
    workspaceId ? s.streamingWorkspaces.has(workspaceId) : false,
  );
  const projects = useStore(workspaceStore, (s) => s.projects);
  const workspaces = useStore(workspaceStore, (s) => s.workspaces);
  const currentProjectId = useStore(workspaceStore, (s) => s.currentProjectId);

  useEffect(() => {
    if (!workspaceId) return;

    const coreId =
      workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
    if (!coreId) {
      chatStore
        .getState()
        .loadHistory(workspaceId)
        .catch(() => {});
      return;
    }

    // Check for active stream first, then load history
    multiCoreStore
      .getState()
      .requestOnCore<{
        active: boolean;
        content?: string;
        thinking?: string;
      }>(coreId, 'agent', 'activeStream', { workspaceId })
      .then((stream) => {
        // Load history first (gets the user message)
        return chatStore
          .getState()
          .loadHistory(workspaceId)
          .then(() => stream);
      })
      .then((stream) => {
        if (stream.active) {
          // Agent is still working — add streaming placeholder with accumulated content
          const msgs = chatStore.getState().messages.get(workspaceId) ?? [];
          const last = msgs[msgs.length - 1];
          if (!last?.isStreaming) {
            const placeholder: ChatMessage = {
              id: `reconnect_${Date.now()}`,
              role: 'assistant',
              content: stream.content ?? '',
              thinking: stream.thinking,
              timestamp: new Date().toISOString(),
              isStreaming: true,
            };
            const newMsgs = new Map(chatStore.getState().messages);
            newMsgs.set(workspaceId, [...msgs, placeholder]);
            const newStreaming = new Set(chatStore.getState().streamingWorkspaces);
            newStreaming.add(workspaceId);
            chatStore.setState({ messages: newMsgs, streamingWorkspaces: newStreaming });
          }
        }
      })
      .catch(() => {
        chatStore
          .getState()
          .loadHistory(workspaceId)
          .catch(() => {});
      });
  }, [workspaceId]);

  return {
    workspace,
    messages,
    isStreaming,
    sendMessage: async (message: string) => {
      if (workspaceId) {
        await chatStore.getState().sendMessage(workspaceId, message);
      }
    },
    approveAction: async (actionId: string) => {
      if (workspaceId) {
        await chatStore.getState().approveAction(workspaceId, actionId);
      }
    },
    rejectAction: async (actionId: string) => {
      if (workspaceId) {
        await chatStore.getState().rejectAction(workspaceId, actionId);
      }
    },
    // Project management
    projects,
    currentProjectId,
    fetchProjects: () => workspaceStore.getState().fetchProjects(),
    createProject: (name, opts) => workspaceStore.getState().createProject(name, opts),
    deleteProject: (projectId) => workspaceStore.getState().deleteProject(projectId),
    setCurrentProject: (projectId) => workspaceStore.getState().setCurrentProject(projectId),
    // Workspace management
    workspaces,
    fetchWorkspaces: (projectId) => workspaceStore.getState().fetchWorkspaces(projectId),
    createWorkspace: (projectId, name, branch) =>
      workspaceStore.getState().createWorkspace(projectId, name, branch),
    enterWorkspace: (wsId) => workspaceStore.getState().enterWorkspace(wsId),
    suspendWorkspace: (wsId) => workspaceStore.getState().suspendWorkspace(wsId),
    resumeWorkspace: (wsId) => workspaceStore.getState().resumeWorkspace(wsId),
    destroyWorkspace: (wsId) => workspaceStore.getState().destroyWorkspace(wsId),
  };
}
