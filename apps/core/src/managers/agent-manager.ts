import type { AgentMessage } from '@condrix/protocol';
import { generateId } from '@condrix/protocol';
import type { EventEmitter } from 'node:events';

import type { CoreDatabase } from '../database.js';
import type { ToolResult } from '../tools/tool-executor.js';
import { ToolExecutor } from '../tools/tool-executor.js';

/** Callback for streaming responses from an agent provider. */
export type StreamCallback = (event: { type: 'thinking' | 'text'; delta: string }) => void;

/** Callback for executing a tool during an agentic loop. */
export type ToolExecutorFn = (toolName: string, input: Record<string, unknown>) => Promise<ToolResult>;

/** Provider abstraction for agent backends. */
export interface AgentProviderAdapter {
  readonly name: string;
  sendMessage(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
    toolExecutor?: ToolExecutorFn,
  ): Promise<{ content: string; thinking?: string }>;
}

/** Builds workspace context (system prompt with codebase info). */
export interface WorkspaceContextProvider {
  buildContext(workspaceId: string): Promise<string | null>;
}

/** Resolves the workspace directory path for tool execution. */
export interface WorkspacePathResolver {
  getWorkspacePath(workspaceId: string): string | undefined;
}

/** Fallback provider when no AI is configured — prompts the user to authenticate. */
export class EchoProvider implements AgentProviderAdapter {
  readonly name = 'echo';
  async sendMessage(
    _history: AgentMessage[],
    _message: string,
  ): Promise<{ content: string }> {
    return {
      content:
        '**No AI model configured.** Please authenticate to start using the agent:\n\n' +
        '- **Settings → Model → "Sign in with Claude"** (OAuth with your Claude Pro/Max plan)\n' +
        '- **Settings → Model → API Key** (paste an Anthropic API key)\n' +
        '- Or set the `ANTHROPIC_API_KEY` environment variable on the Core\n\n' +
        'Once authenticated, send your message again.',
    };
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
/** Tracks an in-flight streaming response so reconnecting clients can catch up. */
interface ActiveStream {
  workspaceId: string;
  content: string;
  thinking: string;
  startedAt: string;
}

export class AgentManager {
  private sessions = new Map<string, AgentSession>();
  private workspaceToSession = new Map<string, string>();
  private providers = new Map<string, AgentProviderAdapter>();
  private defaultProvider = 'echo';
  private contextProvider: WorkspaceContextProvider | null = null;
  private pathResolver: WorkspacePathResolver | null = null;
  /** Active streaming responses — keyed by workspaceId. */
  private activeStreams = new Map<string, ActiveStream>();

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

  /** Set the workspace path resolver for tool execution. */
  setPathResolver(resolver: WorkspacePathResolver): void {
    this.pathResolver = resolver;
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

    // Track active stream so reconnecting clients can catch up
    this.activeStreams.set(workspaceId, {
      workspaceId,
      content: '',
      thinking: '',
      startedAt: timestamp,
    });

    // Stream callback: emit events for real-time UI updates + accumulate in buffer
    const onStream: StreamCallback = (event) => {
      const stream = this.activeStreams.get(workspaceId);
      if (stream) {
        if (event.type === 'text') stream.content += event.delta;
        else if (event.type === 'thinking') stream.thinking += event.delta;
      }
      this.emitter.emit(`agent:${event.type}Delta`, {
        workspaceId,
        delta: event.delta,
      });
    };

    // Build tool executor if we have a path resolver
    let toolExecutor: ToolExecutorFn | undefined;
    if (this.pathResolver) {
      const wsPath = this.pathResolver.getWorkspacePath(workspaceId);
      if (wsPath) {
        const executor = new ToolExecutor(wsPath);
        toolExecutor = (name, input) => executor.execute(name, input);
      }
    }

    // Apply workspace-level config overrides (model, systemPrompt, maxTokens)
    const wsConfig = this.db.getWorkspaceConfig(workspaceId);
    let providerReconfigured = false;
    const originalConfig: Record<string, unknown> = {};

    if (Object.keys(wsConfig).length > 0 && 'reconfigure' in session.provider) {
      const provider = session.provider as AgentProviderAdapter & {
        reconfigure: (config: Record<string, unknown>) => void;
      };
      // Save original values to restore after this call
      if (wsConfig.model) {
        originalConfig.model = (provider as unknown as { model: string }).model;
        provider.reconfigure({ model: wsConfig.model });
        providerReconfigured = true;
      }
      if (wsConfig.systemPrompt) {
        originalConfig.systemPrompt = (provider as unknown as { systemPrompt: string | undefined }).systemPrompt;
        provider.reconfigure({ systemPrompt: wsConfig.systemPrompt });
        providerReconfigured = true;
      }
      if (wsConfig.maxTokens) {
        originalConfig.maxTokens = (provider as unknown as { maxTokens: number }).maxTokens;
        provider.reconfigure({ maxTokens: Number(wsConfig.maxTokens) });
        providerReconfigured = true;
      }
    }

    // Send to provider with streaming and tool execution
    let result: { content: string; thinking?: string };
    try {
      console.log(`[AgentManager] Sending to provider "${session.provider.name}" for workspace ${workspaceId}`);
      result = await session.provider.sendMessage(agentHistory, message, onStream, toolExecutor);
    } catch (err) {
      this.activeStreams.delete(workspaceId);
      console.error(`[AgentManager] Provider error:`, err instanceof Error ? err.message : err);
      throw err;
    } finally {
      // Restore original provider config after the call
      if (providerReconfigured && 'reconfigure' in session.provider) {
        const provider = session.provider as AgentProviderAdapter & {
          reconfigure: (config: Record<string, unknown>) => void;
        };
        provider.reconfigure(originalConfig);
      }
    }

    // Clear active stream
    this.activeStreams.delete(workspaceId);

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

  /** Get active streaming response for a workspace (for reconnecting clients). */
  getActiveStream(workspaceId: string): ActiveStream | undefined {
    return this.activeStreams.get(workspaceId);
  }

  /** Get all active streams (for status queries). */
  getActiveStreams(): ActiveStream[] {
    return Array.from(this.activeStreams.values());
  }

  cancelSession(workspaceId: string): boolean {
    const sessionId = this.workspaceToSession.get(workspaceId);
    if (!sessionId) return false;
    this.sessions.delete(sessionId);
    this.workspaceToSession.delete(workspaceId);
    return true;
  }
}
