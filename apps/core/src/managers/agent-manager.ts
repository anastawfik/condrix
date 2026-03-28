import type { AgentMessage } from '@condrix/protocol';
import { generateId } from '@condrix/protocol';
import type { EventEmitter } from 'node:events';
import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import type { CoreDatabase } from '../database.js';
import type { ToolResult } from '../tools/tool-executor.js';
import { ToolExecutor } from '../tools/tool-executor.js';

/** Dev-mode event log file path (null if not in dev mode). */
const devEventLog = (() => {
  if (process.env.CONDRIX_CORE_DEV_MODE === 'false') return null;
  const dir = join(homedir(), '.condrix');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'claude-events.log');
})();

function logEvent(workspaceId: string, event: Record<string, unknown>): void {
  if (!devEventLog) return;
  const ts = new Date().toISOString();
  const type = event.type as string;
  const summary: Record<string, unknown> = { type };
  if (type === 'thinking' || type === 'text') {
    summary.deltaLen = (event.delta as string)?.length ?? 0;
    summary.blockIndex = event.blockIndex;
  } else if (type === 'toolUse') {
    summary.toolName = event.toolName;
    summary.toolId = (event.toolId as string)?.slice(0, 12);
  } else if (type === 'toolResult') {
    summary.toolId = (event.toolId as string)?.slice(0, 12);
    summary.contentLen = (event.content as string)?.length ?? 0;
  } else {
    summary.delta = (event.delta as string)?.slice(0, 50);
  }
  appendFileSync(devEventLog, `${ts} [${workspaceId.slice(0, 12)}] ${JSON.stringify(summary)}\n`);
}

/** Callback for streaming responses from an agent provider. */
export type StreamEvent =
  | { type: 'thinking' | 'text'; delta: string; blockIndex?: number }
  | { type: 'toolUse'; toolId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'toolResult'; toolId: string; content: string }
  | { type: 'modeChanged'; delta: string };

export type StreamCallback = (event: StreamEvent) => void;

/** Callback for executing a tool during an agentic loop. */
export type ToolExecutorFn = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<ToolResult>;

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
  async sendMessage(_history: AgentMessage[], _message: string): Promise<{ content: string }> {
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
interface ContentBlock {
  type: 'thinking' | 'text' | 'toolUse' | 'toolResult';
  content: string;
  toolId?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  _blockIndex?: number;
}

interface ActiveStream {
  workspaceId: string;
  content: string;
  thinking: string;
  contentBlocks: ContentBlock[];
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

  async sendMessage(
    workspaceId: string,
    message: string,
  ): Promise<{
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
      contentBlocks: [],
      startedAt: timestamp,
    });

    /** Append to the server-side content blocks array (mirrors client-side appendToBlocks). */
    const appendBlock = (block: ContentBlock) => {
      const stream = this.activeStreams.get(workspaceId);
      if (!stream) return;
      const blocks = stream.contentBlocks;
      const last = blocks[blocks.length - 1];
      if (
        (block.type === 'thinking' || block.type === 'text') &&
        last?.type === block.type &&
        (block._blockIndex === undefined || last._blockIndex === block._blockIndex)
      ) {
        last.content += block.content;
      } else {
        blocks.push({ ...block });
      }
    };

    // Reset dev event log for this request
    if (devEventLog)
      writeFileSync(devEventLog, `--- Request at ${timestamp} workspace=${workspaceId} ---\n`);

    // Stream callback: emit events for real-time UI updates + accumulate in buffer
    const onStream: StreamCallback = (event) => {
      logEvent(workspaceId, event as unknown as Record<string, unknown>);
      if (event.type === 'modeChanged') {
        this.db.setWorkspaceConfig(workspaceId, 'permissionMode', event.delta);
        this.emitter.emit('agent:modeChanged', { workspaceId, permissionMode: event.delta });
        return;
      }
      if (event.type === 'toolUse') {
        appendBlock({
          type: 'toolUse',
          content: '',
          toolId: event.toolId,
          toolName: event.toolName,
          input: event.input,
        });
        this.emitter.emit('agent:toolUse', {
          workspaceId,
          toolId: event.toolId,
          toolName: event.toolName,
          input: event.input,
        });
        return;
      }
      if (event.type === 'toolResult') {
        appendBlock({
          type: 'toolResult',
          content: event.content,
          toolId: event.toolId,
        });
        this.emitter.emit('agent:toolResult', {
          workspaceId,
          toolId: event.toolId,
          content: event.content,
        });
        return;
      }
      const stream = this.activeStreams.get(workspaceId);
      if (stream) {
        if (event.type === 'text') stream.content += event.delta;
        else if (event.type === 'thinking') stream.thinking += event.delta;
      }
      appendBlock({ type: event.type, content: event.delta, _blockIndex: event.blockIndex });
      this.emitter.emit(`agent:${event.type}Delta`, {
        workspaceId,
        delta: event.delta,
        blockIndex: event.blockIndex,
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

    // Apply workspace-level config overrides (model, systemPrompt, maxTokens, permissionMode, workDir, sessionId)
    const wsConfig = this.db.getWorkspaceConfig(workspaceId);
    let providerReconfigured = false;
    const originalConfig: Record<string, unknown> = {};

    if ('reconfigure' in session.provider) {
      const provider = session.provider as AgentProviderAdapter & {
        reconfigure: (config: Record<string, unknown>) => void;
      };

      // Always set workspace working directory for subprocess cwd
      if (this.pathResolver) {
        const wsPath = this.pathResolver.getWorkspacePath(workspaceId);
        if (wsPath) {
          originalConfig.workDir = (provider as unknown as { workDir: string | undefined }).workDir;
          provider.reconfigure({ workDir: wsPath });
          providerReconfigured = true;
        }
      }

      // Restore saved session ID for --resume
      const agentState = this.db.getAgentState(workspaceId);
      if (agentState?.sessionData) {
        const data = agentState.sessionData as { claudeSessionId?: string };
        if (data.claudeSessionId) {
          originalConfig.sessionId = undefined;
          provider.reconfigure({ sessionId: data.claudeSessionId });
          providerReconfigured = true;
        }
      }

      // Save original values to restore after this call
      if (wsConfig.model) {
        originalConfig.model = (provider as unknown as { model: string }).model;
        provider.reconfigure({ model: wsConfig.model });
        providerReconfigured = true;
      }
      if (wsConfig.systemPrompt) {
        originalConfig.systemPrompt = (
          provider as unknown as { systemPrompt: string | undefined }
        ).systemPrompt;
        provider.reconfigure({ systemPrompt: wsConfig.systemPrompt });
        providerReconfigured = true;
      }
      if (wsConfig.maxTokens) {
        originalConfig.maxTokens = (provider as unknown as { maxTokens: number }).maxTokens;
        provider.reconfigure({ maxTokens: Number(wsConfig.maxTokens) });
        providerReconfigured = true;
      }
      if (wsConfig.permissionMode) {
        originalConfig.permissionMode = (
          provider as unknown as { permissionMode: string | undefined }
        ).permissionMode;
        provider.reconfigure({ permissionMode: wsConfig.permissionMode });
        providerReconfigured = true;
      }
    }

    // Send to provider with streaming and tool execution
    let result: { content: string; thinking?: string };
    try {
      console.log(
        `[AgentManager] Sending to provider "${session.provider.name}" for workspace ${workspaceId}`,
      );
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

    // Capture contentBlocks before clearing active stream
    const streamBlocks = this.activeStreams.get(workspaceId)?.contentBlocks ?? [];
    // Strip internal _blockIndex before persisting
    const finalBlocks = streamBlocks.map(({ _blockIndex, ...rest }) => rest);

    // Clear active stream
    this.activeStreams.delete(workspaceId);

    // Persist Claude session ID for resume on next request
    if ('getLastSessionId' in session.provider) {
      const provider = session.provider as AgentProviderAdapter & {
        getLastSessionId: () => string | undefined;
      };
      const claudeSessionId = provider.getLastSessionId();
      if (claudeSessionId) {
        this.db.upsertAgentState(workspaceId, session.provider.name, undefined, {
          claudeSessionId,
        });
      }
    }

    // Persist assistant message
    const assistantMsgId = generateId('msg');
    const assistantTimestamp = new Date().toISOString();
    this.db.insertConversation(
      assistantMsgId,
      workspaceId,
      'assistant',
      result.content,
      assistantTimestamp,
      undefined,
      result.thinking,
      finalBlocks.length > 0 ? finalBlocks : undefined,
    );

    this.emitter.emit('agent:message', {
      workspaceId,
      role: 'assistant' as const,
      content: result.content,
      thinking: result.thinking,
      contentBlocks: finalBlocks.length > 0 ? finalBlocks : undefined,
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
    const messages = rows.slice(0, limit ?? 50).map((r) => ({
      role: r.role as 'user' | 'assistant' | 'system',
      content: r.content,
      timestamp: r.timestamp,
      thinking: r.thinking,
      contentBlocks: r.contentBlocks as ContentBlock[] | undefined,
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
