/**
 * Chat state management.
 * Tracks messages per workspace, streaming state, and agent interactions.
 * Supports real-time streaming of thinking and text deltas.
 *
 * Multi-client sync: when another client sends a message, the Core broadcasts
 * agent:message events to all connected clients. This store subscribes to those
 * events and adds messages it doesn't already have.
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

  /** IDs of assistant messages this client received via request/response (to avoid duplicating from broadcasts). */
  _ownMessageIds: Set<string>;
  /** Workspaces where this client has a pending send (to skip broadcast user messages). */
  _pendingSendWorkspaces: Set<string>;
  /** Currently active streaming placeholder ID per workspace. */
  _streamingPlaceholders: Map<string, string>;
  /** Cleanup functions for broadcast subscriptions per core. */
  _broadcastUnsubs: Map<string, () => void>;

  getMessages: (workspaceId: string) => ChatMessage[];
  isStreaming: (workspaceId: string) => boolean;
  sendMessage: (workspaceId: string, message: string) => Promise<void>;
  loadHistory: (workspaceId: string, limit?: number) => Promise<void>;
  approveAction: (workspaceId: string, actionId: string) => Promise<void>;
  rejectAction: (workspaceId: string, actionId: string) => Promise<void>;
  subscribeToBroadcasts: (coreId: string) => void;
  unsubscribeFromBroadcasts: (coreId: string) => void;
  _handleAgentEvent: (workspaceId: string, event: MessageEnvelope) => void;
}

export const createChatStore = () =>
  createStore<ChatStore>((set, get) => ({
    messages: new Map(),
    streamingWorkspaces: new Set(),
    _ownMessageIds: new Set(),
    _pendingSendWorkspaces: new Set(),
    _streamingPlaceholders: new Map(),
    _broadcastUnsubs: new Map(),

    getMessages: (workspaceId) => get().messages.get(workspaceId) ?? [],

    isStreaming: (workspaceId) => get().streamingWorkspaces.has(workspaceId),

    /**
     * Subscribe to agent broadcast events on a Core connection.
     * This enables multi-client sync — messages sent by other clients
     * will appear in real time.
     */
    subscribeToBroadcasts: (coreId: string) => {
      // Don't double-subscribe
      if (get()._broadcastUnsubs.has(coreId)) return;

      const conn = multiCoreStore.getState().getConnection(coreId);
      if (!conn) return;

      const store = conn.store.getState();

      // Subscribe to agent:message — both user and assistant messages broadcast by Core
      const unsubMessage = store.subscribe('agent:message', (event) => {
        const payload = event.payload as {
          workspaceId: string;
          messageId?: string;
          role: string;
          content: string;
          thinking?: string;
          timestamp: string;
        };

        const msgId = payload.messageId ?? `broadcast_${Date.now()}`;

        // Skip user messages from our own sends (we already added them optimistically)
        if (payload.role === 'user' && get()._pendingSendWorkspaces.has(payload.workspaceId)) {
          return;
        }

        // Skip assistant messages we received via request/response
        if (get()._ownMessageIds.has(msgId)) return;

        // Skip if we already have this message (by ID)
        const existing = get().messages.get(payload.workspaceId) ?? [];
        if (existing.some((m) => m.id === msgId)) return;

        // Skip assistant messages if we're streaming our own request on this workspace
        if (payload.role === 'assistant' && get()._streamingPlaceholders.has(payload.workspaceId)) {
          return;
        }

        // If there's a remote streaming placeholder for this workspace, replace it
        // with the final message instead of adding a duplicate
        const remoteId = `remote_streaming_${payload.workspaceId}`;
        if (payload.role === 'assistant' && existing.some((m) => m.id === remoteId)) {
          updateMessage(set, get, payload.workspaceId, remoteId, () => ({
            id: msgId,
            role: 'assistant' as const,
            content: payload.content,
            thinking: payload.thinking,
            timestamp: payload.timestamp,
            isStreaming: false,
          }));

          set((s) => {
            const newStreaming = new Set(s.streamingWorkspaces);
            newStreaming.delete(payload.workspaceId);
            return { streamingWorkspaces: newStreaming };
          });
          return;
        }

        const msg: ChatMessage = {
          id: msgId,
          role: payload.role as ChatMessage['role'],
          content: payload.content,
          thinking: payload.thinking,
          timestamp: payload.timestamp,
        };

        addMessage(set, get, payload.workspaceId, msg);
      });

      // Subscribe to streaming deltas for other clients' requests
      const unsubThinking = store.subscribe('agent:thinkingDelta', (event) => {
        const payload = event.payload as { workspaceId: string; delta: string };

        // If we have our own streaming placeholder, the sendMessage handler handles this
        if (get()._streamingPlaceholders.has(payload.workspaceId)) return;

        // Another client is streaming — create or update a remote streaming placeholder
        const remoteId = `remote_streaming_${payload.workspaceId}`;
        const msgs = get().messages.get(payload.workspaceId) ?? [];
        const existing = msgs.find((m) => m.id === remoteId);

        if (!existing) {
          // Mark as streaming
          set((s) => {
            const newStreaming = new Set(s.streamingWorkspaces);
            newStreaming.add(payload.workspaceId);
            return { streamingWorkspaces: newStreaming };
          });

          const placeholder: ChatMessage = {
            id: remoteId,
            role: 'assistant',
            content: '',
            thinking: payload.delta,
            timestamp: new Date().toISOString(),
            isStreaming: true,
          };
          addMessage(set, get, payload.workspaceId, placeholder);
        } else {
          updateMessage(set, get, payload.workspaceId, remoteId, (msg) => ({
            ...msg,
            thinking: (msg.thinking ?? '') + payload.delta,
          }));
        }
      });

      const unsubText = store.subscribe('agent:textDelta', (event) => {
        const payload = event.payload as { workspaceId: string; delta: string };

        if (get()._streamingPlaceholders.has(payload.workspaceId)) return;

        const remoteId = `remote_streaming_${payload.workspaceId}`;
        const msgs = get().messages.get(payload.workspaceId) ?? [];
        const existing = msgs.find((m) => m.id === remoteId);

        if (!existing) {
          set((s) => {
            const newStreaming = new Set(s.streamingWorkspaces);
            newStreaming.add(payload.workspaceId);
            return { streamingWorkspaces: newStreaming };
          });

          const placeholder: ChatMessage = {
            id: remoteId,
            role: 'assistant',
            content: payload.delta,
            thinking: '',
            timestamp: new Date().toISOString(),
            isStreaming: true,
          };
          addMessage(set, get, payload.workspaceId, placeholder);
        } else {
          updateMessage(set, get, payload.workspaceId, remoteId, (msg) => ({
            ...msg,
            content: msg.content + payload.delta,
          }));
        }
      });

      const cleanup = () => {
        unsubMessage();
        unsubThinking();
        unsubText();
      };

      const unsubs = new Map(get()._broadcastUnsubs);
      unsubs.set(coreId, cleanup);
      set({ _broadcastUnsubs: unsubs });
    },

    unsubscribeFromBroadcasts: (coreId: string) => {
      const unsub = get()._broadcastUnsubs.get(coreId);
      if (unsub) {
        unsub();
        const unsubs = new Map(get()._broadcastUnsubs);
        unsubs.delete(coreId);
        set({ _broadcastUnsubs: unsubs });
      }
    },

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

      // Track that this workspace has a pending send
      const pendingSends = new Set(get()._pendingSendWorkspaces);
      pendingSends.add(workspaceId);
      set({ _pendingSendWorkspaces: pendingSends });

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

      // Track the placeholder so broadcast handlers know to skip this workspace
      const placeholders = new Map(get()._streamingPlaceholders);
      placeholders.set(workspaceId, placeholderId);
      set({ _streamingPlaceholders: placeholders });

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

        // Track the final message ID so we don't duplicate from broadcast
        get()._ownMessageIds.add(result.messageId);

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

        // Clear streaming placeholder and pending send tracking
        const ph = new Map(get()._streamingPlaceholders);
        ph.delete(workspaceId);
        const ps = new Set(get()._pendingSendWorkspaces);
        ps.delete(workspaceId);
        set({ _streamingPlaceholders: ph, _pendingSendWorkspaces: ps });

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
        const msgId = (payload.messageId as string) ?? `msg_${Date.now()}`;

        // Skip if we already have this message
        if (get()._ownMessageIds.has(msgId)) return;
        const existing = get().messages.get(workspaceId) ?? [];
        if (existing.some((m) => m.id === msgId)) return;

        const msg: ChatMessage = {
          id: msgId,
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
        // Finalize any remote streaming placeholder
        const remoteId = `remote_streaming_${workspaceId}`;
        const msgs = get().messages.get(workspaceId) ?? [];
        if (msgs.some((m) => m.id === remoteId)) {
          updateMessage(set, get, workspaceId, remoteId, (msg) => ({
            ...msg,
            isStreaming: false,
          }));
        }

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

/**
 * Auto-subscribe to agent broadcasts whenever a Core connects.
 * Call once at app startup.
 */
export function initChatSync(): () => void {
  const connectedCores = new Set<string>();

  const unsub = multiCoreStore.subscribe((state) => {
    // Subscribe to newly connected cores
    for (const [coreId, conn] of state.connections) {
      if (conn.connState === 'connected' && !connectedCores.has(coreId)) {
        connectedCores.add(coreId);
        chatStore.getState().subscribeToBroadcasts(coreId);
      }
    }

    // Unsubscribe from disconnected cores
    for (const coreId of connectedCores) {
      if (!state.connections.has(coreId)) {
        connectedCores.delete(coreId);
        chatStore.getState().unsubscribeFromBroadcasts(coreId);
      }
    }
  });

  return unsub;
}
