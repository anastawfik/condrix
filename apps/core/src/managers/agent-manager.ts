import type { AgentMessage } from '@nexus-core/protocol';
import { generateId } from '@nexus-core/protocol';
import type { EventEmitter } from 'node:events';

import type { CoreDatabase } from '../database.js';

/** Callback for streaming responses from an agent provider. */
export type StreamCallback = (event: { type: 'thinking' | 'text'; delta: string }) => void;

/** Provider abstraction for agent backends. */
export interface AgentProviderAdapter {
  readonly name: string;
  sendMessage(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
  ): Promise<{ content: string; thinking?: string }>;
}

/** Builds workspace context (system prompt with codebase info). */
export interface WorkspaceContextProvider {
  buildContext(workspaceId: string): Promise<string | null>;
}

/** Echo provider for Phase 1 — returns the user's message prefixed with [Echo]. */
export class EchoProvider implements AgentProviderAdapter {
  readonly name = 'echo';
  async sendMessage(
    _history: AgentMessage[],
    message: string,
  ): Promise<{ content: string }> {
    return { content: `[Echo] ${message}` };
  }
}

interface AgentSession {
  workspaceId: string;
  provider: AgentProviderAdapter;
}

/**
 * Handles the lifecycle of AI agents within workspaces.
 * Responsible for spawning agent processes, managing context windows,
 * routing tool calls, and handling conversation history.
 */
export class AgentManager {
  private sessions = new Map<string, AgentSession>();
  private workspaceToSession = new Map<string, string>();
  private providers = new Map<string, AgentProviderAdapter>();
  private defaultProvider = 'echo';
  private contextProvider: WorkspaceContextProvider | null = null;

  constructor(
    private db: CoreDatabase,
    private emitter: EventEmitter,
  ) {
    this.registerProvider(new EchoProvider());
  }

  /** Set the workspace context provider for injecting codebase context. */
  setContextProvider(provider: WorkspaceContextProvider): void {
    this.contextProvider = provider;
  }

  /** Set which provider is used for new sessions by default. */
  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Cannot set default provider: "${name}" is not registered`);
    }
    this.defaultProvider = name;
  }

  registerProvider(provider: AgentProviderAdapter): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): AgentProviderAdapter | undefined {
    return this.providers.get(name);
  }

  createSession(workspaceId: string, providerName: string): string {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Unknown agent provider: ${providerName}`);
    }

    // Reuse existing session for workspace
    const existing = this.workspaceToSession.get(workspaceId);
    if (existing) return existing;

    const sessionId = generateId('agent');
    this.sessions.set(sessionId, { workspaceId, provider });
    this.workspaceToSession.set(workspaceId, sessionId);
    this.db.upsertAgentState(workspaceId, providerName);
    return sessionId;
  }

  getSessionByWorkspace(workspaceId: string): string | undefined {
    return this.workspaceToSession.get(workspaceId);
  }

  async sendMessage(workspaceId: string, message: string): Promise<{
    messageId: string;
    content: string;
    thinking?: string;
  }> {
    // Auto-create session with default provider if none exists
    let sessionId = this.workspaceToSession.get(workspaceId);
    if (!sessionId) {
      sessionId = this.createSession(workspaceId, this.defaultProvider);
    }

    const session = this.sessions.get(sessionId)!;
    const timestamp = new Date().toISOString();

    // Persist user message
    const userMsgId = generateId('msg');
    this.db.insertConversation(userMsgId, workspaceId, 'user', message, timestamp);

    // Broadcast user message so other clients see it
    this.emitter.emit('agent:message', {
      workspaceId,
      messageId: userMsgId,
      role: 'user' as const,
      content: message,
      timestamp,
    });

    // Get history for context
    const history = this.db.getConversationHistory(workspaceId);
    const agentHistory: AgentMessage[] = history.map((h) => ({
      role: h.role as 'user' | 'assistant' | 'system',
      content: h.content,
      timestamp: h.timestamp,
    }));

    // Inject workspace context as a system message at the start of history
    if (this.contextProvider) {
      try {
        const context = await this.contextProvider.buildContext(workspaceId);
        if (context) {
          agentHistory.unshift({
            role: 'system',
            content: context,
            timestamp,
          });
        }
      } catch (err) {
        console.warn('[AgentManager] Failed to build workspace context:', err);
      }
    }

    // Stream callback: emit events for real-time UI updates
    const onStream: StreamCallback = (event) => {
      this.emitter.emit(`agent:${event.type}Delta`, {
        workspaceId,
        delta: event.delta,
      });
    };

    // Send to provider with streaming
    const result = await session.provider.sendMessage(agentHistory, message, onStream);

    // Persist assistant message
    const assistantMsgId = generateId('msg');
    const assistantTimestamp = new Date().toISOString();
    this.db.insertConversation(assistantMsgId, workspaceId, 'assistant', result.content, assistantTimestamp);

    this.emitter.emit('agent:message', {
      workspaceId,
      role: 'assistant' as const,
      content: result.content,
      thinking: result.thinking,
      timestamp: assistantTimestamp,
    });

    return { messageId: assistantMsgId, content: result.content, thinking: result.thinking };
  }

  getHistory(
    workspaceId: string,
    limit?: number,
    before?: string,
  ): { messages: AgentMessage[]; hasMore: boolean } {
    const fetchLimit = (limit ?? 50) + 1;
    const rows = this.db.getConversationHistory(workspaceId, fetchLimit, before);
    const hasMore = rows.length > (limit ?? 50);
    const messages: AgentMessage[] = rows.slice(0, limit ?? 50).map((r) => ({
      role: r.role as 'user' | 'assistant' | 'system',
      content: r.content,
      timestamp: r.timestamp,
    }));
    return { messages, hasMore };
  }

  cancelSession(workspaceId: string): boolean {
    const sessionId = this.workspaceToSession.get(workspaceId);
    if (!sessionId) return false;
    this.sessions.delete(sessionId);
    this.workspaceToSession.delete(workspaceId);
    return true;
  }
}
