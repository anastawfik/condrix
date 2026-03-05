/**
 * React hook for workspace state and agent interactions.
 * Thin wrapper around workspace and chat Zustand stores.
 */
import { useStore } from 'zustand';
import { useEffect } from 'react';
import type { WorkspaceInfo } from '@nexus-core/protocol';

import { workspaceStore } from '../stores/workspace-store.js';
import { chatStore, type ChatMessage } from '../stores/chat-store.js';

export interface UseWorkspaceReturn {
  workspace: WorkspaceInfo | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (message: string) => Promise<void>;
  approveAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string) => Promise<void>;
}

export function useWorkspace(workspaceId: string | null): UseWorkspaceReturn {
  const workspace = useStore(workspaceStore, (s) => s.currentWorkspace);
  const messages = useStore(chatStore, (s) => workspaceId ? s.getMessages(workspaceId) : []);
  const isStreaming = useStore(chatStore, (s) => workspaceId ? s.isStreaming(workspaceId) : false);

  useEffect(() => {
    if (workspaceId) {
      chatStore.getState().loadHistory(workspaceId).catch(() => { /* ignore */ });
    }
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
  };
}
