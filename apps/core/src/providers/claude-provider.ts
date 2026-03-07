/**
 * Claude AI provider using the Anthropic SDK.
 * Supports streaming, extended thinking, and authentication via API key or OAuth.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AgentMessage } from '@nexus-core/protocol';

import type { AgentProviderAdapter, StreamCallback } from '../managers/agent-manager.js';

export interface ClaudeProviderConfig {
  apiKey?: string;
  authToken?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  thinkingBudget?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_MAX_TOKENS = 16000;
const DEFAULT_THINKING_BUDGET = 10000;

const OAUTH_BETA = 'oauth-2025-04-20';

export class ClaudeProvider implements AgentProviderAdapter {
  readonly name = 'claude';

  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private thinkingBudget: number;
  private systemPrompt: string | undefined;
  private authMethod: 'oauth' | 'apikey';
  private fallbackApiKey: string | undefined;

  constructor(config: ClaudeProviderConfig = {}) {
    if (config.authToken) {
      this.client = new Anthropic({ authToken: config.authToken });
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
  }

  reconfigure(config: Partial<ClaudeProviderConfig>): void {
    if (config.authToken !== undefined) {
      this.client = new Anthropic({ authToken: config.authToken });
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
  }

  async sendMessage(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
  ): Promise<{ content: string; thinking?: string }> {
    const messages = this.buildMessages(history, message);
    const system = this.buildSystem(history);

    // Ensure max_tokens > budget_tokens (API requirement)
    const budgetTokens = Math.min(this.thinkingBudget, this.maxTokens - 1024);
    const effectiveBudget = Math.max(budgetTokens, 1024);
    const effectiveMaxTokens = Math.max(this.maxTokens, effectiveBudget + 1024);

    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: effectiveMaxTokens,
      thinking: { type: 'enabled', budget_tokens: effectiveBudget },
      ...(system ? { system } : {}),
      messages,
    };

    const options = this.authMethod === 'oauth'
      ? { headers: { 'anthropic-beta': OAUTH_BETA } }
      : undefined;

    try {
      if (onStream) {
        return await this.streamResponse(params, options, onStream);
      }
      return await this.nonStreamResponse(params, options);
    } catch (err) {
      // OAuth fallback to API key
      if (
        this.authMethod === 'oauth' &&
        err instanceof Error &&
        (err.message.includes('authentication_error') || err.message.includes('401'))
      ) {
        if (this.fallbackApiKey) {
          console.warn('[Claude] OAuth auth failed, falling back to API key');
          this.client = new Anthropic({ apiKey: this.fallbackApiKey });
          this.authMethod = 'apikey';
          if (onStream) {
            return await this.streamResponse(params, undefined, onStream);
          }
          return await this.nonStreamResponse(params, undefined);
        }
        throw new Error(
          'OAuth authentication failed. Your token may have expired. ' +
          'Try re-importing from Claude Code in Settings, or switch to API Key authentication.',
        );
      }
      throw err;
    }
  }

  private async streamResponse(
    params: Anthropic.MessageCreateParams,
    options: { headers: Record<string, string> } | undefined,
    onStream: StreamCallback,
  ): Promise<{ content: string; thinking?: string }> {
    const stream = this.client.messages.stream(params, options);

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

    return {
      content: content || '[No response]',
      thinking: thinking || undefined,
    };
  }

  private async nonStreamResponse(
    params: Anthropic.MessageCreateParams,
    options: { headers: Record<string, string> } | undefined,
  ): Promise<{ content: string; thinking?: string }> {
    const response = await this.client.messages.create(
      { ...params, stream: false } as Anthropic.MessageCreateParamsNonStreaming,
      options,
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

    return {
      content: content || '[No response]',
      thinking: thinking || undefined,
    };
  }

  private buildMessages(history: AgentMessage[], message: string): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of history) {
      if (msg.role === 'system') continue;
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== message) {
      messages.push({ role: 'user', content: message });
    }

    if (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift();
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
