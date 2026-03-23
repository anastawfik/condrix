/**
 * Claude AI provider using the Anthropic SDK.
 * Supports streaming, extended thinking, tool use with agentic loops,
 * and authentication via API key or OAuth.
 *
 * OAuth requests are intercepted at the HTTP layer to match the exact
 * request shape Anthropic expects for Claude Code OAuth tokens:
 * - ?beta=true query param
 * - User-Agent matching Claude CLI
 * - anthropic-beta header with claude-code client identity
 * - tools[] always present, no temperature/tool_choice
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AgentMessage } from '@nexus-core/protocol';

import type { AgentProviderAdapter, StreamCallback, ToolExecutorFn } from '../managers/agent-manager.js';
import { agentTools } from '../tools/tool-definitions.js';

export interface ClaudeProviderConfig {
  apiKey?: string;
  authToken?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  thinkingBudget?: number;
  /** Called to refresh the OAuth token when a 403 "revoked" error occurs. */
  tokenRefresher?: () => Promise<string>;
}

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';
const DEFAULT_MAX_TOKENS = 16000;
const DEFAULT_THINKING_BUDGET = 10000;
const MAX_TOOL_TURNS = 25;

/** Headers and params that make OAuth tokens work with Sonnet/Opus. */
const OAUTH_USER_AGENT = 'claude-cli/1.0.0 (external, cli)';
const OAUTH_BETA_FLAGS = 'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14';

/**
 * Creates a fetch wrapper that transforms requests to match the Claude Code
 * CLI request shape. This is required for OAuth tokens to work with premium
 * models (Sonnet, Opus) — Anthropic's backend validates the request shape.
 */
function createOAuthFetch(): typeof globalThis.fetch {
  const baseFetch = globalThis.fetch;

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Add ?beta=true to the URL
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}beta=true`;

    // Override headers
    const headers = new Headers(init?.headers);
    headers.set('User-Agent', OAUTH_USER_AGENT);
    headers.set('anthropic-beta', OAUTH_BETA_FLAGS);

    // Modify body: ensure tools[] present, strip temperature/tool_choice
    let body = init?.body;
    if (body && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.tools) {
          parsed.tools = [];
        }
        delete parsed.temperature;
        delete parsed.tool_choice;
        body = JSON.stringify(parsed);
      } catch {
        // Not JSON, pass through
      }
    }

    return baseFetch(url, {
      ...init,
      headers,
      body,
    });
  };
}

export class ClaudeProvider implements AgentProviderAdapter {
  readonly name = 'claude';

  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private thinkingBudget: number;
  private systemPrompt: string | undefined;
  private authMethod: 'oauth' | 'apikey';
  private fallbackApiKey: string | undefined;
  private tokenRefresher: (() => Promise<string>) | undefined;

  constructor(config: ClaudeProviderConfig = {}) {
    if (config.authToken) {
      console.log(`[Claude] Creating client with OAuth token (${config.authToken.substring(0, 15)}...)`);
      this.client = new Anthropic({
        authToken: config.authToken,
        fetch: createOAuthFetch(),
      });
      this.authMethod = 'oauth';
      this.fallbackApiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    } else {
      this.client = new Anthropic({ apiKey: config.apiKey });
      this.authMethod = 'apikey';
    }
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.thinkingBudget = config.thinkingBudget ?? DEFAULT_THINKING_BUDGET;
    this.systemPrompt = config.systemPrompt;
    this.tokenRefresher = config.tokenRefresher;
  }

  reconfigure(config: Partial<ClaudeProviderConfig>): void {
    if (config.authToken !== undefined) {
      this.client = new Anthropic({
        authToken: config.authToken,
        fetch: createOAuthFetch(),
      });
      this.authMethod = 'oauth';
    } else if (config.apiKey !== undefined) {
      this.client = new Anthropic({ apiKey: config.apiKey });
      this.authMethod = 'apikey';
      this.fallbackApiKey = config.apiKey;
    }
    if (config.model !== undefined) this.model = config.model;
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens;
    if (config.thinkingBudget !== undefined) this.thinkingBudget = config.thinkingBudget;
    if (config.systemPrompt !== undefined) this.systemPrompt = config.systemPrompt || undefined;
    if (config.tokenRefresher !== undefined) this.tokenRefresher = config.tokenRefresher;
  }

  async sendMessage(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
    toolExecutor?: ToolExecutorFn,
  ): Promise<{ content: string; thinking?: string }> {
    const messages = this.buildMessages(history, message);
    const system = this.buildSystem(history);

    const baseParams: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      ...(system ? { system } : {}),
      messages,
      ...(toolExecutor ? { tools: agentTools } : {}),
    };

    try {
      if (toolExecutor) {
        return await this.agenticLoop(baseParams, onStream, toolExecutor);
      }
      if (onStream) {
        return await this.streamResponse(baseParams, onStream);
      }
      return await this.nonStreamResponse(baseParams);
    } catch (err) {
      if (this.authMethod !== 'oauth' || !(err instanceof Error)) throw err;

      const msg = err.message;
      const isOAuthError =
        msg.includes('authentication_error') || msg.includes('401') ||
        msg.includes('permission_error') || msg.includes('403') ||
        msg.includes('revoked') || msg.includes('not authorized');

      if (!isOAuthError) throw err;

      console.warn('[Claude] OAuth API error:', msg);

      // Step 1: Try refreshing the token
      if (this.tokenRefresher) {
        let newToken: string | undefined;
        try {
          console.warn('[Claude] Attempting token refresh...');
          newToken = await this.tokenRefresher();
          console.log('[Claude] Token refresh succeeded, retrying request...');
        } catch (refreshErr) {
          console.warn('[Claude] Token refresh failed:', refreshErr instanceof Error ? refreshErr.message : refreshErr);
        }

        // Step 2: If refresh succeeded, retry
        if (newToken) {
          this.client = new Anthropic({
            authToken: newToken,
            fetch: createOAuthFetch(),
          });
          try {
            if (toolExecutor) return await this.agenticLoop(baseParams, onStream, toolExecutor);
            if (onStream) return await this.streamResponse(baseParams, onStream);
            return await this.nonStreamResponse(baseParams);
          } catch (retryErr) {
            console.warn('[Claude] Retry with refreshed token also failed:', retryErr instanceof Error ? retryErr.message : retryErr);
          }
        }
      }

      // Step 3: Fall back to API key if available
      if (this.fallbackApiKey) {
        console.warn('[Claude] Falling back to API key');
        this.client = new Anthropic({ apiKey: this.fallbackApiKey });
        this.authMethod = 'apikey';
        this.tokenRefresher = undefined;
        if (toolExecutor) return await this.agenticLoop(baseParams, onStream, toolExecutor);
        if (onStream) return await this.streamResponse(baseParams, onStream);
        return await this.nonStreamResponse(baseParams);
      }

      throw new Error(
        'OAuth authentication failed — your authorization may have been fully revoked by Anthropic. ' +
        'Please sign in again via Settings → Authentication → "Sign in with Claude" (browser login), ' +
        'or configure an API key instead.',
      );
    }
  }

  /**
   * Agentic loop: send messages, handle tool_use blocks, execute tools,
   * send results back, and repeat until Claude responds with text only.
   */
  private async agenticLoop(
    baseParams: Anthropic.MessageCreateParams,
    onStream: StreamCallback | undefined,
    toolExecutor: ToolExecutorFn,
  ): Promise<{ content: string; thinking?: string }> {
    const messages = [...(baseParams.messages as Anthropic.MessageParam[])];
    let allThinking = '';
    let finalContent = '';
    let turns = 0;

    while (turns < MAX_TOOL_TURNS) {
      turns++;

      const params: Anthropic.MessageCreateParams = {
        ...baseParams,
        messages,
      };

      const stream = this.client.messages.stream(params);
      let turnThinking = '';
      let turnContent = '';
      const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      const contentBlocks: Anthropic.ContentBlock[] = [];

      stream.on('thinking', (delta: string) => {
        turnThinking += delta;
        if (onStream) onStream({ type: 'thinking', delta });
      });

      stream.on('text', (delta: string) => {
        turnContent += delta;
        if (onStream) onStream({ type: 'text', delta });
      });

      const finalMessage = await stream.finalMessage();

      for (const block of finalMessage.content) {
        contentBlocks.push(block);
        if (block.type === 'tool_use') {
          toolUseBlocks.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      if (turnThinking) allThinking += (allThinking ? '\n\n' : '') + turnThinking;

      if (toolUseBlocks.length === 0 || finalMessage.stop_reason !== 'tool_use') {
        finalContent = turnContent || '[No response]';
        break;
      }

      if (onStream) {
        const toolNames = toolUseBlocks.map((t) => t.name).join(', ');
        onStream({ type: 'text', delta: `\n\n*Using tools: ${toolNames}...*\n\n` });
      }

      messages.push({ role: 'assistant', content: contentBlocks });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tool of toolUseBlocks) {
        const result = await toolExecutor(tool.name, tool.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: result.content,
          is_error: result.isError,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    if (turns >= MAX_TOOL_TURNS) {
      finalContent += '\n\n[Reached maximum tool use turns]';
    }

    return { content: finalContent, thinking: allThinking || undefined };
  }

  private async streamResponse(
    params: Anthropic.MessageCreateParams,
    onStream: StreamCallback,
  ): Promise<{ content: string; thinking?: string }> {
    const stream = this.client.messages.stream(params);

    let thinking = '';
    let content = '';

    stream.on('thinking', (delta: string) => {
      thinking += delta;
      onStream({ type: 'thinking', delta });
    });

    stream.on('text', (delta: string) => {
      content += delta;
      onStream({ type: 'text', delta });
    });

    await stream.finalMessage();

    return { content: content || '[No response]', thinking: thinking || undefined };
  }

  private async nonStreamResponse(
    params: Anthropic.MessageCreateParams,
  ): Promise<{ content: string; thinking?: string }> {
    const response = await this.client.messages.create(
      { ...params, stream: false } as Anthropic.MessageCreateParamsNonStreaming,
    );

    let thinking = '';
    let content = '';

    for (const block of response.content) {
      if (block.type === 'thinking') {
        thinking += (block as Anthropic.ThinkingBlock).thinking;
      } else if (block.type === 'text') {
        content += (block as Anthropic.TextBlock).text;
      }
    }

    return { content: content || '[No response]', thinking: thinking || undefined };
  }

  private buildMessages(history: AgentMessage[], message: string): Anthropic.MessageParam[] {
    const raw: Anthropic.MessageParam[] = [];

    for (const msg of history) {
      if (msg.role === 'system') continue;
      raw.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const lastMsg = raw[raw.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== message) {
      raw.push({ role: 'user', content: message });
    }

    if (raw.length > 0 && raw[0].role !== 'user') {
      raw.shift();
    }

    // Merge consecutive same-role messages (API requires alternating roles)
    const messages: Anthropic.MessageParam[] = [];
    for (const msg of raw) {
      const prev = messages[messages.length - 1];
      if (prev && prev.role === msg.role) {
        prev.content = `${prev.content as string}\n\n${msg.content as string}`;
      } else {
        messages.push({ ...msg });
      }
    }

    return messages;
  }

  private buildSystem(history: AgentMessage[]): string | undefined {
    const systemParts: string[] = [];
    if (this.systemPrompt) {
      systemParts.push(this.systemPrompt);
    }
    for (const msg of history) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      }
    }
    return systemParts.length > 0 ? systemParts.join('\n\n') : undefined;
  }
}
