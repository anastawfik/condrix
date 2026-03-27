/**
 * Claude AI provider.
 *
 * Two auth modes:
 * - API key: uses @anthropic-ai/sdk directly (standard API calls)
 * - OAuth (Claude Plan): uses @anthropic-ai/claude-agent-sdk which wraps
 *   the Claude Code CLI. Required because OAuth tokens are scoped to
 *   Claude Code's client and rejected for direct API calls on Sonnet/Opus.
 *   Supports sessions for multi-turn conversation context per workspace.
 */
import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentMessage } from '@condrix/protocol';

import type {
  AgentProviderAdapter,
  StreamCallback,
  ToolExecutorFn,
} from '../managers/agent-manager.js';
import { agentTools } from '../tools/tool-definitions.js';

export interface ClaudeProviderConfig {
  apiKey?: string;
  authToken?: string;
  oauthTokenJson?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  thinkingBudget?: number;
  tokenRefresher?: () => Promise<string>;
  workDir?: string;
  permissionMode?: 'plan' | 'autoaccept' | 'auto';
  sessionId?: string;
}

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';
const DEFAULT_MAX_TOKENS = 16000;
const DEFAULT_THINKING_BUDGET = 10000;
const MAX_TOOL_TURNS = 25;

export class ClaudeProvider implements AgentProviderAdapter {
  readonly name = 'claude';

  private client: Anthropic | undefined;
  private model: string;
  private maxTokens: number;
  private thinkingBudget: number;
  private systemPrompt: string | undefined;
  private authMethod: 'oauth' | 'apikey';
  private fallbackApiKey: string | undefined;
  private tokenRefresher: (() => Promise<string>) | undefined;
  private oauthTokenJson: string | undefined;
  private workDir: string | undefined;
  private permissionMode: 'plan' | 'autoaccept' | 'auto' | undefined;
  private sessionId: string | undefined;
  /** Session ID returned by the last subprocess run — used for --resume. */
  private lastSessionId: string | undefined;

  constructor(config: ClaudeProviderConfig = {}) {
    if (config.authToken) {
      console.log('[Claude] Creating provider with OAuth (Agent SDK mode)');
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
      if (config.oauthTokenJson !== undefined) this.oauthTokenJson = config.oauthTokenJson;
    } else if (config.apiKey !== undefined && config.apiKey) {
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
    if (config.workDir !== undefined) this.workDir = config.workDir;
    if (config.permissionMode !== undefined) this.permissionMode = config.permissionMode;
    if (config.sessionId !== undefined) this.lastSessionId = config.sessionId;
  }

  /** Returns the session ID from the last subprocess run (for persistence). */
  getLastSessionId(): string | undefined {
    return this.lastSessionId;
  }

  async sendMessage(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
    toolExecutor?: ToolExecutorFn,
  ): Promise<{ content: string; thinking?: string }> {
    if (this.authMethod === 'oauth') {
      return this.sendViaSubprocess(history, message, onStream);
    }
    return this.sendViaSdk(history, message, onStream, toolExecutor);
  }

  // ─── Agent SDK Path (OAuth) ────────────────────────────────────────────────

  private async sendViaSubprocess(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
  ): Promise<{ content: string; thinking?: string }> {
    const system = this.buildSystem(history);

    // Build prompt with history context
    const promptParts: string[] = [];
    for (const msg of history) {
      if (msg.role === 'system') continue;
      const prefix = msg.role === 'user' ? 'User' : 'Assistant';
      promptParts.push(`${prefix}: ${msg.content}`);
    }
    promptParts.push(`User: ${message}`);
    const fullPrompt = promptParts.length > 1 ? promptParts.join('\n\n') : message;

    const args = [
      '-p',
      fullPrompt,
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--model',
      this.model,
    ];
    if (system) {
      args.push('--system-prompt', system);
    }
    // Resume previous session for context continuity
    if (this.lastSessionId) {
      args.push('--resume', this.lastSessionId);
    }
    // Permission mode (Claude CLI accepts: plan, auto, acceptEdits, bypassPermissions, default, dontAsk)
    if (this.permissionMode) {
      const modeMap = { plan: 'plan', autoaccept: 'acceptEdits', auto: 'auto' } as const;
      args.push('--permission-mode', modeMap[this.permissionMode]);
    }

    console.log(
      `[Claude] Subprocess query (model: ${this.model}, cwd: ${this.workDir ?? 'inherited'})`,
    );

    return new Promise((resolve, reject) => {
      let content = '';
      let thinking = '';
      let stderr = '';
      const emittedToolIds = new Set<string>();

      const child = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0', NODE_OPTIONS: '' },
        ...(this.workDir ? { cwd: this.workDir } : {}),
      });

      // Log raw NDJSON to file for debugging
      const logDir = join(homedir(), '.condrix');
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
      const logFile = join(logDir, 'claude-ndjson.log');
      writeFileSync(
        logFile,
        `--- Request at ${new Date().toISOString()} | model=${this.model} cwd=${this.workDir ?? 'inherited'} ---\n`,
      );

      const rl = createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        if (!line.trim()) return;
        appendFileSync(logFile, line + '\n');
        try {
          const event = JSON.parse(line);

          // Stream deltas from content_block_delta events
          if (event.type === 'stream_event' && event.event?.type === 'content_block_delta') {
            const delta = event.event.delta;
            const blockIndex = event.event.index as number | undefined;
            if (delta?.type === 'text_delta' && delta.text) {
              content += delta.text;
              if (onStream) onStream({ type: 'text', delta: delta.text, blockIndex });
            } else if (delta?.type === 'thinking_delta' && delta.thinking) {
              thinking += delta.thinking;
              if (onStream) onStream({ type: 'thinking', delta: delta.thinking, blockIndex });
            }
          }
          // Tool use: emit from assistant partial messages (has complete input)
          else if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content as Array<{
              type: string;
              id?: string;
              name?: string;
              input?: Record<string, unknown>;
            }>) {
              if (
                block.type === 'tool_use' &&
                block.id &&
                block.name &&
                !emittedToolIds.has(block.id)
              ) {
                emittedToolIds.add(block.id);
                if (onStream)
                  onStream({
                    type: 'toolUse',
                    toolId: block.id,
                    toolName: block.name,
                    input: block.input ?? {},
                  });
              }
            }
          }
          // Tool results from user messages (tool execution output)
          else if (event.type === 'user' && event.message?.content) {
            for (const block of event.message.content as Array<{
              type: string;
              tool_use_id?: string;
              content?: string;
            }>) {
              if (block.type === 'tool_result' && block.tool_use_id) {
                if (onStream)
                  onStream({
                    type: 'toolResult',
                    toolId: block.tool_use_id,
                    content:
                      typeof block.content === 'string'
                        ? block.content
                        : JSON.stringify(block.content),
                  });
              }
            }
          }
          // Permission mode change detection
          else if (event.type === 'system' && event.permission_mode) {
            const modeReverseMap: Record<string, string> = {
              plan: 'plan',
              acceptEdits: 'autoaccept',
              auto: 'auto',
              bypassPermissions: 'auto',
              dontAsk: 'auto',
              default: 'plan',
            };
            const normalized = modeReverseMap[event.permission_mode] ?? event.permission_mode;
            if (normalized !== this.permissionMode) {
              this.permissionMode = normalized as 'plan' | 'autoaccept' | 'auto';
              if (onStream) onStream({ type: 'modeChanged', delta: normalized });
            }
          }
          // Final result
          else if (event.type === 'result') {
            // Capture session ID for resume on next request
            if (event.session_id) {
              this.lastSessionId = event.session_id;
            }
            // Detect permission mode from result metadata
            if (event.permission_mode) {
              const modeReverseMap: Record<string, string> = {
                plan: 'plan',
                'auto-accept': 'autoaccept',
                auto: 'auto',
              };
              const normalized = modeReverseMap[event.permission_mode] ?? event.permission_mode;
              if (normalized !== this.permissionMode) {
                this.permissionMode = normalized as 'plan' | 'autoaccept' | 'auto';
                if (onStream) onStream({ type: 'modeChanged', delta: normalized });
              }
            }
            if (event.subtype === 'success' && event.result && !content) {
              content = event.result;
              if (onStream) onStream({ type: 'text', delta: content });
            } else if (event.is_error) {
              stderr += event.result ?? '';
            }
          }
        } catch {
          /* not JSON */
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        if (content) {
          resolve({ content, thinking: thinking || undefined });
        } else if (code === 0) {
          resolve({ content: '[No response]', thinking: thinking || undefined });
        } else {
          console.error(`[Claude] Subprocess failed (code ${code}): ${stderr.slice(0, 300)}`);
          reject(
            new Error(
              `Claude CLI failed (code ${code}): ${stderr.slice(0, 200) || 'unknown error'}`,
            ),
          );
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
      });

      child.stdin.end();
    });
  }

  // ─── Anthropic SDK Path (API Key) ──────────────────────────────────────────

  private async sendViaSdk(
    history: AgentMessage[],
    message: string,
    onStream?: StreamCallback,
    toolExecutor?: ToolExecutorFn,
  ): Promise<{ content: string; thinking?: string }> {
    const messages = this.buildMessages(history, message);
    const system = this.buildSystem(history);

    if (!this.client) {
      throw new Error('No API client available. Configure an API key.');
    }

    const baseParams: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      ...(system ? { system } : {}),
      messages,
      ...(toolExecutor ? { tools: agentTools } : {}),
    };

    if (toolExecutor) return this.agenticLoop(baseParams, onStream, toolExecutor);
    if (onStream) return this.streamResponse(baseParams, onStream);
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
      const stream = this.client!.messages.stream(params);
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

      if (onStream)
        onStream({
          type: 'text',
          delta: `\n\n*Using tools: ${toolUseBlocks.map((t) => t.name).join(', ')}...*\n\n`,
        });

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

    if (turns >= MAX_TOOL_TURNS) finalContent += '\n\n[Reached maximum tool use turns]';
    return { content: finalContent, thinking: allThinking || undefined };
  }

  private async streamResponse(
    params: Anthropic.MessageCreateParams,
    onStream: StreamCallback,
  ): Promise<{ content: string; thinking?: string }> {
    const stream = this.client!.messages.stream(params);
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
    const response = await this.client!.messages.create({
      ...params,
      stream: false,
    } as Anthropic.MessageCreateParamsNonStreaming);
    let thinking = '';
    let content = '';
    for (const block of response.content) {
      if (block.type === 'thinking') thinking += (block as Anthropic.ThinkingBlock).thinking;
      else if (block.type === 'text') content += (block as Anthropic.TextBlock).text;
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
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== message)
      raw.push({ role: 'user', content: message });
    if (raw.length > 0 && raw[0].role !== 'user') raw.shift();

    const messages: Anthropic.MessageParam[] = [];
    for (const msg of raw) {
      const prev = messages[messages.length - 1];
      if (prev && prev.role === msg.role)
        prev.content = `${prev.content as string}\n\n${msg.content as string}`;
      else messages.push({ ...msg });
    }
    return messages;
  }

  private buildSystem(history: AgentMessage[]): string | undefined {
    const systemParts: string[] = [];
    if (this.systemPrompt) systemParts.push(this.systemPrompt);
    for (const msg of history) {
      if (msg.role === 'system') systemParts.push(msg.content);
    }
    return systemParts.length > 0 ? systemParts.join('\n\n') : undefined;
  }
}
