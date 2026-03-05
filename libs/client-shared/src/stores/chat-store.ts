/**
 * Chat state management.
 * Tracks messages per workspace, streaming state, and agent interactions.
 */
import { createStore } from 'zustand/vanilla';
import type { MessageEnvelope } from '@nexus-core/protocol';

import { connectionStore } from './connection-store.js';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export interface ChatStore {
  messages: Map<string, ChatMessage[]>;
  streamingWorkspaces: Set<string>;

  getMessages: (workspaceId: string) => ChatMessage[];
  isStreaming: (workspaceId: string) => boolean;
  sendMessage: (workspaceId: string, message: string) => Promise<void>;
  loadHistory: (workspaceId: string, limit?: number) => Promise<void>;
  approveAction: (workspaceId: string, actionId: string) => Promise<void>;
  rejectAction: (workspaceId: string, actionId: string) => Promise<void>;
  _handleAgentEvent: (workspaceId: string, event: MessageEnvelope) => void;
}

export const createChatStore = () =>
  createStore<ChatStore>((set, get) => ({
    messages: new Map(),
    streamingWorkspaces: new Set(),

    getMessages: (workspaceId) => get().messages.get(workspaceId) ?? [],

    isStreaming: (workspaceId) => get().streamingWorkspaces.has(workspaceId),

    sendMessage: async (workspaceId, message) => {
      const conn = connectionStore.getState();

      // Add user message optimistically
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      addMessage(set, get, workspaceId, userMsg);

      // Mark as streaming
      set((s) => {
        const newStreaming = new Set(s.streamingWorkspaces);
        newStreaming.add(workspaceId);
        return { streamingWorkspaces: newStreaming };
      });

      try {
        const result = await conn.request<{ messageId: string; content: string }>(
          'agent', 'chat', { workspaceId, message },
        );

        // Add assistant response
        const assistantMsg: ChatMessage = {
          id: result.messageId,
          role: 'assistant',
          content: result.content,
          timestamp: new Date().toISOString(),
        };
        addMessage(set, get, workspaceId, assistantMsg);
      } finally {
        set((s) => {
          const newStreaming = new Set(s.streamingWorkspaces);
          newStreaming.delete(workspaceId);
          return { streamingWorkspaces: newStreaming };
        });
      }
    },

    loadHistory: async (workspaceId, limit = 50) => {
      const conn = connectionStore.getState();
      const result = await conn.request<{ messages: Array<{ role: string; content: string; timestamp: string; metadata?: Record<string, unknown> }>; hasMore: boolean }>(
        'agent', 'history', { workspaceId, limit },
      );
      const mapped: ChatMessage[] = result.messages.map((m, i) => ({
        id: `hist_${i}`,
        role: m.role as ChatMessage['role'],
        content: m.content,
        timestamp: m.timestamp,
        metadata: m.metadata,
      }));
      const newMessages = new Map(get().messages);
      newMessages.set(workspaceId, mapped);
      set({ messages: newMessages });
    },

    approveAction: async (workspaceId, actionId) => {
      const conn = connectionStore.getState();
      await conn.request('agent', 'approve', { workspaceId, actionId });
    },

    rejectAction: async (workspaceId, actionId) => {
      const conn = connectionStore.getState();
      await conn.request('agent', 'reject', { workspaceId, actionId });
    },

    _handleAgentEvent: (workspaceId, event) => {
      const action = event.action;
      const payload = event.payload as Record<string, unknown>;

      if (action === 'message') {
        const msg: ChatMessage = {
          id: (payload.messageId as string) ?? `msg_${Date.now()}`,
          role: ((payload.role as string) ?? 'assistant') as ChatMessage['role'],
          content: (payload.content as string) ?? '',
          timestamp: (payload.timestamp as string) ?? new Date().toISOString(),
        };
        addMessage(set, get, workspaceId, msg);
      } else if (action === 'toolCall') {
        // Append tool call to last assistant message
        const msgs = get().getMessages(workspaceId);
        const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) {
          const toolCall: ToolCall = {
            id: payload.toolCallId as string,
            name: payload.name as string,
            args: (payload.args as Record<string, unknown>) ?? {},
            status: 'pending',
          };
          lastAssistant.toolCalls = [...(lastAssistant.toolCalls ?? []), toolCall];
          const newMessages = new Map(get().messages);
          set({ messages: newMessages });
        }
      } else if (action === 'complete') {
        set((s) => {
          const newStreaming = new Set(s.streamingWorkspaces);
          newStreaming.delete(workspaceId);
          return { streamingWorkspaces: newStreaming };
        });
      }
    },
  }));

function addMessage(
  set: (fn: (s: ChatStore) => Partial<ChatStore>) => void,
  get: () => ChatStore,
  workspaceId: string,
  msg: ChatMessage,
): void {
  const newMessages = new Map(get().messages);
  const existing = newMessages.get(workspaceId) ?? [];
  newMessages.set(workspaceId, [...existing, msg]);
  set(() => ({ messages: newMessages }));
}

export const chatStore = createChatStore();
