import type { AgentMessage } from '@nexus-core/protocol';
import { generateId } from '@nexus-core/protocol';
import type { EventEmitter } from 'node:events';

import type { CoreDatabase } from '../database.js';

/** Provider abstraction for agent backends. */
export interface AgentProviderAdapter {
  readonly name: string;
  sendMessage(
    history: AgentMessage[],
    message: string,
  ): Promise<{ content: string }>;
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

  constructor(
    private db: CoreDatabase,
    private emitter: EventEmitter,
  ) {
    this.registerProvider(new EchoProvider());
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

    // Get history for context
    const history = this.db.getConversationHistory(workspaceId);
    const agentHistory: AgentMessage[] = history.map((h) => ({
      role: h.role as 'user' | 'assistant' | 'system',
      content: h.content,
      timestamp: h.timestamp,
    }));

    // Send to provider
    const result = await session.provider.sendMessage(agentHistory, message);

    // Persist assistant message
    const assistantMsgId = generateId('msg');
    const assistantTimestamp = new Date().toISOString();
    this.db.insertConversation(assistantMsgId, workspaceId, 'assistant', result.content, assistantTimestamp);

    this.emitter.emit('agent:message', {
      role: 'assistant' as const,
      content: result.content,
      timestamp: assistantTimestamp,
    });

    return { messageId: assistantMsgId, content: result.content };
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
