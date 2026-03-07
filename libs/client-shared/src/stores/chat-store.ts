/**
 * Chat state management.
 * Tracks messages per workspace, streaming state, and agent interactions.
 * Supports real-time streaming of thinking and text deltas.
 */
import { createStore } from 'zustand/vanilla';
import type { MessageEnvelope } from '@nexus-core/protocol';

import { multiCoreStore } from './multi-core-store.js';
import { workspaceStore } from './workspace-store.js';

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
  thinking?: string;
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
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) throw new Error('No active Core connection');

      // Add user message optimistically
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      addMessage(set, get, workspaceId, userMsg);

      // Add streaming placeholder for assistant response
      const placeholderId = `streaming_${Date.now()}`;
      const placeholder: ChatMessage = {
        id: placeholderId,
        role: 'assistant',
        content: '',
        thinking: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      addMessage(set, get, workspaceId, placeholder);

      // Mark as streaming
      set((s) => {
        const newStreaming = new Set(s.streamingWorkspaces);
        newStreaming.add(workspaceId);
        return { streamingWorkspaces: newStreaming };
      });

      // Subscribe to streaming events
      const conn = multiCoreStore.getState().getConnection(coreId);
      if (!conn) throw new Error(`No connection for core ${coreId}`);

      const unsubThinking = conn.store.getState().subscribe('agent:thinkingDelta', (event) => {
        const payload = event.payload as { workspaceId: string; delta: string };
        if (payload.workspaceId !== workspaceId) return;
        updateMessage(set, get, workspaceId, placeholderId, (msg) => ({
          ...msg,
          thinking: (msg.thinking ?? '') + payload.delta,
        }));
      });

      const unsubText = conn.store.getState().subscribe('agent:textDelta', (event) => {
        const payload = event.payload as { workspaceId: string; delta: string };
        if (payload.workspaceId !== workspaceId) return;
        updateMessage(set, get, workspaceId, placeholderId, (msg) => ({
          ...msg,
          content: msg.content + payload.delta,
        }));
      });

      try {
        const result = await conn.store.getState().request<{
          messageId: string;
          content: string;
          thinking?: string;
        }>('agent', 'chat', { workspaceId, message }, 300_000);

        // Finalize: replace placeholder with final message
        updateMessage(set, get, workspaceId, placeholderId, (msg) => ({
          ...msg,
          id: result.messageId,
          content: result.content,
          thinking: result.thinking ?? msg.thinking,
          isStreaming: false,
        }));
      } catch (err) {
        const errorContent = err instanceof Error ? err.message : 'Unknown error';
        // Replace placeholder with error message
        updateMessage(set, get, workspaceId, placeholderId, (msg) => ({
          ...msg,
          id: `err_${Date.now()}`,
          role: 'system' as const,
          content: `Failed to get response: ${errorContent}`,
          thinking: undefined,
          isStreaming: false,
          metadata: { error: true },
        }));
      } finally {
        unsubThinking();
        unsubText();
        set((s) => {
          const newStreaming = new Set(s.streamingWorkspaces);
          newStreaming.delete(workspaceId);
          return { streamingWorkspaces: newStreaming };
        });
      }
    },

    loadHistory: async (workspaceId, limit = 50) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      const result = await multiCoreStore.getState().requestOnCore<{ messages: Array<{ role: string; content: string; timestamp: string; metadata?: Record<string, unknown> }>; hasMore: boolean }>(
        coreId, 'agent', 'history', { workspaceId, limit },
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
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      await multiCoreStore.getState().requestOnCore(coreId, 'agent', 'approve', { workspaceId, actionId });
    },

    rejectAction: async (workspaceId, actionId) => {
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      await multiCoreStore.getState().requestOnCore(coreId, 'agent', 'reject', { workspaceId, actionId });
    },

    _handleAgentEvent: (workspaceId, event) => {
      const action = event.action;
      const payload = event.payload as Record<string, unknown>;

      if (action === 'message') {
        const msg: ChatMessage = {
          id: (payload.messageId as string) ?? `msg_${Date.now()}`,
          role: ((payload.role as string) ?? 'assistant') as ChatMessage['role'],
          content: (payload.content as string) ?? '',
          thinking: payload.thinking as string | undefined,
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

function updateMessage(
  set: (fn: (s: ChatStore) => Partial<ChatStore>) => void,
  get: () => ChatStore,
  workspaceId: string,
  messageId: string,
  updater: (msg: ChatMessage) => ChatMessage,
): void {
  const newMessages = new Map(get().messages);
  const msgs = newMessages.get(workspaceId) ?? [];
  const idx = msgs.findIndex((m) => m.id === messageId);
  if (idx >= 0) {
    const updated = [...msgs];
    updated[idx] = updater(updated[idx]);
    newMessages.set(workspaceId, updated);
    set(() => ({ messages: newMessages }));
  }
}

export const chatStore = createChatStore();
