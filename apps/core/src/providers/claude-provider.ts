/**
 * Claude AI provider using the Anthropic SDK.
 * Supports authentication via ANTHROPIC_API_KEY env var.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AgentMessage } from '@nexus-core/protocol';

import type { AgentProviderAdapter } from '../managers/agent-manager.js';

export interface ClaudeProviderConfig {
  /** API key — defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Model ID — defaults to claude-sonnet-4-5. */
  model?: string;
  /** Max output tokens — defaults to 8192. */
  maxTokens?: number;
  /** System prompt prepended to every conversation. */
  systemPrompt?: string;
}

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_MAX_TOKENS = 8192;

export class ClaudeProvider implements AgentProviderAdapter {
  readonly name = 'claude';

  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private systemPrompt: string | undefined;

  constructor(config: ClaudeProviderConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey, // undefined → falls back to ANTHROPIC_API_KEY env var
    });
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.systemPrompt = config.systemPrompt;
  }

  reconfigure(config: Partial<ClaudeProviderConfig>): void {
    if (config.apiKey !== undefined) {
      this.client = new Anthropic({ apiKey: config.apiKey });
    }
    if (config.model !== undefined) {
      this.model = config.model;
    }
    if (config.maxTokens !== undefined) {
      this.maxTokens = config.maxTokens;
    }
    if (config.systemPrompt !== undefined) {
      this.systemPrompt = config.systemPrompt || undefined;
    }
  }

  async sendMessage(
    history: AgentMessage[],
    message: string,
  ): Promise<{ content: string }> {
    // Build messages array from conversation history
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of history) {
      if (msg.role === 'system') continue; // system messages go in the system param
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Ensure alternating user/assistant and append current user message
    // If the last message in history is already the current user message (just persisted),
    // don't duplicate it. Otherwise append.
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== message) {
      messages.push({ role: 'user', content: message });
    }

    // Ensure first message is user role (API requirement)
    if (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift();
    }

    // Build system prompt from history system messages + configured prompt
    const systemParts: string[] = [];
    if (this.systemPrompt) {
      systemParts.push(this.systemPrompt);
    }
    for (const msg of history) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      }
    }
    const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      ...(system ? { system } : {}),
      messages,
    });

    // Extract text content from the response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    const content = textBlocks.map((b) => b.text).join('\n\n');

    return { content: content || '[No response]' };
  }
}
