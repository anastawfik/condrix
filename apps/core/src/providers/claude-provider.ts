/**
 * Claude AI provider.
 *
 * Two modes:
 * - API key: uses @anthropic-ai/sdk directly (standard API calls)
 * - OAuth: spawns `claude` CLI subprocess with CLAUDE_CODE_OAUTH_TOKEN env var
 *   (required because OAuth tokens are scoped to Claude Code and rejected
 *   when used directly with the API for Sonnet/Opus models)
 */
import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { AgentMessage } from '@nexus-core/protocol';

import type { AgentProviderAdapter, StreamCallback, ToolExecutorFn } from '../managers/agent-manager.js';
import { agentTools } from '../tools/tool-definitions.js';

export interface ClaudeProviderConfig {
  apiKey?: string;
  authToken?: string;
  /** Full OAuth token JSON for CLAUDE_CODE_OAUTH_TOKEN env var. */
  oauthTokenJson?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  thinkingBudget?: number;
  tokenRefresher?: () => Promise<string>;
}

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';
const DEFAULT_MAX_TOKENS = 16000;
const DEFAULT_THINKING_BUDGET = 10000;
const MAX_TOOL_TURNS = 25;

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
  private oauthTokenJson: string | undefined;

  constructor(config: ClaudeProviderConfig = {}) {
    if (config.authToken) {
      console.log(`[Claude] Creating provider with OAuth (subprocess mode)`);
      // For OAuth we still create an SDK client as fallback, but primary path is subprocess
      this.client = new Anthropic({ apiKey: config.apiKey ?? 'unused' });
      this.authMethod = 'oauth';
      this.fallbackApiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
      this.oauthTokenJson = config.oauthTokenJson;
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
      this.authMethod = 'oauth';
      this.oauthTokenJson = config.oauthTokenJson;
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
    if (config.oauthTokenJson !== undefined) this.oauthTokenJson = config.oauthTokenJson;
  }

  async sendMessage(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
    toolExecutor?: ToolExecutorFn,
  ): Promise<{ content: string; thinking?: string }> {
    // OAuth: use claude CLI subprocess
    if (this.authMethod === 'oauth' && this.oauthTokenJson) {
      try {
        return await this.sendViaSubprocess(history, message, onStream);
      } catch (err) {
        console.warn('[Claude] Subprocess failed:', (err as Error).message);

        // Try refreshing token
        if (this.tokenRefresher) {
          try {
            await this.tokenRefresher();
            return await this.sendViaSubprocess(history, message, onStream);
          } catch {
            console.warn('[Claude] Retry after refresh also failed');
          }
        }

        // Fall back to API key if available
        if (this.fallbackApiKey) {
          console.warn('[Claude] Falling back to API key');
          this.client = new Anthropic({ apiKey: this.fallbackApiKey });
          this.authMethod = 'apikey';
          // Fall through to SDK path below
        } else {
          throw err;
        }
      }
    }

    // API key: use SDK directly
    return this.sendViaSdk(history, message, onStream, toolExecutor);
  }

  // ─── Subprocess Path (OAuth) ───────────────────────────────────────────────

  private async sendViaSubprocess(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
  ): Promise<{ content: string; thinking?: string }> {
    const system = this.buildSystem(history);

    // Build conversation as a single prompt with history context
    const promptParts: string[] = [];
    for (const msg of history) {
      if (msg.role === 'system') continue;
      const prefix = msg.role === 'user' ? 'User' : 'Assistant';
      promptParts.push(`${prefix}: ${msg.content}`);
    }
    promptParts.push(`User: ${message}`);
    const fullPrompt = promptParts.length > 1
      ? promptParts.join('\n\n')
      : message;

    const args = [
      '-p', fullPrompt,
      '--output-format', 'stream-json',
      '--model', this.model,
      '--verbose',
    ];

    if (system) {
      args.push('--system-prompt', system);
    }

    return new Promise((resolve, reject) => {
      let content = '';
      let thinking = '';
      let stderr = '';

      const child = spawn('claude', args, {
        env: {
          ...process.env,
          CLAUDE_CODE_OAUTH_TOKEN: this.oauthTokenJson,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Parse NDJSON from stdout
      const rl = createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
          const event = JSON.parse(line);

          // Handle different event types from stream-json output
          if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if (delta?.type === 'thinking_delta' && delta.thinking) {
              thinking += delta.thinking;
              if (onStream) onStream({ type: 'thinking', delta: delta.thinking });
            } else if (delta?.type === 'text_delta' && delta.text) {
              content += delta.text;
              if (onStream) onStream({ type: 'text', delta: delta.text });
            }
          } else if (event.type === 'result') {
            // Final result event — may contain the full text
            if (event.result && !content) {
              content = event.result;
            }
          } else if (event.type === 'assistant' && event.message?.content) {
            // Full message event
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text && !content) {
                content = block.text;
              } else if (block.type === 'thinking' && block.thinking) {
                thinking = block.thinking;
              }
            }
          }
        } catch {
          // Not JSON, ignore
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        if (code === 0 || content) {
          resolve({
            content: content || '[No response]',
            thinking: thinking || undefined,
          });
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr.trim().slice(0, 500)}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn claude CLI: ${err.message}. Is Claude Code installed?`));
      });

      // Close stdin immediately (we passed prompt via -p flag)
      child.stdin.end();
    });
  }

  // ─── SDK Path (API Key) ────────────────────────────────────────────────────

  private async sendViaSdk(
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

    if (toolExecutor) {
      return this.agenticLoop(baseParams, onStream, toolExecutor);
    }
    if (onStream) {
      return this.streamResponse(baseParams, onStream);
    }
    return this.nonStreamResponse(baseParams);
  }

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
      const params: Anthropic.MessageCreateParams = { ...baseParams, messages };
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

  // ─── Message Building ──────────────────────────────────────────────────────

  private buildMessages(history: AgentMessage[], message: string): Anthropic.MessageParam[] {
    const raw: Anthropic.MessageParam[] = [];

    for (const msg of history) {
      if (msg.role === 'system') continue;
      raw.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }

    const lastMsg = raw[raw.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== message) {
      raw.push({ role: 'user', content: message });
    }

    if (raw.length > 0 && raw[0].role !== 'user') {
      raw.shift();
    }

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
