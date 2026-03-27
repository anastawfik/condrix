import type { StateStore } from './state-store.js';
import type { CoreConnectionManager } from './core-connection-manager.js';
import type { AiConfigDistributor } from './ai-config-distributor.js';

/**
 * Maestro's AI-powered conversational interface.
 * Queries the state store, formulates responses, and optionally
 * dispatches commands to Cores.
 *
 * Supports two modes:
 * 1. Built-in status queries (no AI needed)
 * 2. AI-powered natural language processing (when Claude credentials are configured)
 */
export class ConversationEngine {
  constructor(
    private stateStore: StateStore,
    private coreManager: CoreConnectionManager,
    private aiConfig: AiConfigDistributor,
  ) {}

  async processMessage(message: string): Promise<string> {
    const lower = message.toLowerCase().trim();

    // Built-in commands — no AI required
    if (this.isStatusQuery(lower)) {
      return this.handleStatusQuery();
    }
    if (this.isCoreListQuery(lower)) {
      return this.handleCoreListQuery();
    }
    if (this.isWorkspaceQuery(lower)) {
      return this.handleWorkspaceQuery();
    }
    if (this.isHelpQuery(lower)) {
      return this.handleHelpQuery();
    }

    // AI-powered response (if credentials configured)
    const aiResponse = await this.tryAiResponse(message);
    if (aiResponse) return aiResponse;

    // Fallback
    return `I can help with status queries. Try:\n• "status" — overall system status\n• "cores" — list connected cores\n• "workspaces" — list active workspaces\n• "help" — available commands`;
  }

  // ─── Built-in Query Handlers ──────────────────────────────────────────────

  private isStatusQuery(msg: string): boolean {
    return /^(status|health|overview|dashboard|how.s.*(everything|system)|what.s.*(up|going on))/.test(
      msg,
    );
  }

  private isCoreListQuery(msg: string): boolean {
    return /^(cores?|list\s*cores?|show\s*cores?|connected)/.test(msg);
  }

  private isWorkspaceQuery(msg: string): boolean {
    return /^(workspaces?|list\s*workspaces?|show\s*workspaces?|active|waiting)/.test(msg);
  }

  private isHelpQuery(msg: string): boolean {
    return /^(help|commands?|\?)$/.test(msg);
  }

  private handleStatusQuery(): string {
    const summary = this.stateStore.getSummary();
    const lines = [
      `**Maestro Status**`,
      `Cores: ${summary.cores.online}/${summary.cores.total} online`,
      `Workspaces: ${summary.workspaces.total} total, ${summary.workspaces.active} active, ${summary.workspaces.waiting} waiting`,
    ];

    const waiting = this.stateStore.getWaitingWorkspaces();
    if (waiting.length > 0) {
      lines.push('', '**Waiting for input:**');
      for (const ws of waiting) {
        lines.push(`• ${ws.name || ws.id} (project: ${ws.projectId ?? 'unknown'})`);
      }
    }

    return lines.join('\n');
  }

  private handleCoreListQuery(): string {
    const cores = this.stateStore.getCores();
    if (cores.length === 0) {
      return 'No Cores registered.';
    }

    const lines = ['**Connected Cores:**'];
    for (const core of cores) {
      const status = core.status === 'online' ? '🟢' : '🔴';
      lines.push(`${status} ${core.displayName} (${core.coreId})`);
    }
    return lines.join('\n');
  }

  private handleWorkspaceQuery(): string {
    const workspaces = this.stateStore.getWorkspaces();
    if (workspaces.length === 0) {
      return 'No active workspaces.';
    }

    const lines = ['**Workspaces:**'];
    for (const ws of workspaces) {
      const stateIcon =
        {
          CREATING: '🔄',
          IDLE: '💤',
          ACTIVE: '🟢',
          WAITING: '⏳',
          SUSPENDED: '⏸️',
          ERRORED: '🔴',
          DESTROYED: '💀',
        }[ws.state] ?? '❓';

      lines.push(`${stateIcon} ${ws.name || ws.id} — ${ws.state}`);
    }
    return lines.join('\n');
  }

  private handleHelpQuery(): string {
    return [
      '**Available Commands:**',
      '• `status` — System overview (cores, workspaces)',
      '• `cores` — List all registered Cores',
      '• `workspaces` — List all workspaces and their states',
      '• `help` — Show this help message',
      '',
      'You can also ask natural language questions when AI is configured.',
    ].join('\n');
  }

  // ─── AI-Powered Response ──────────────────────────────────────────────────

  private async tryAiResponse(message: string): Promise<string | null> {
    const config = this.aiConfig.getConfig();
    const apiKey = config.apiKey;
    const oauthToken = config.oauthAccessToken;

    if (!apiKey && !oauthToken) return null;

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');

      const clientOpts = apiKey
        ? { apiKey }
        : {
            apiKey: 'unused',
            authToken: oauthToken,
            defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
          };
      const client = new Anthropic(clientOpts);

      const summary = this.stateStore.getSummary();
      const cores = this.stateStore.getCores();
      const systemPrompt = [
        'You are Maestro, the orchestration assistant for Condrix.',
        'You help developers manage their AI agent workspaces and Cores.',
        `Current state: ${summary.cores.online}/${summary.cores.total} cores online, ` +
          `${summary.workspaces.active} active workspaces, ${summary.workspaces.waiting} waiting.`,
        `Registered cores: ${cores.map((c) => `${c.displayName} (${c.status})`).join(', ') || 'none'}`,
        'Keep responses concise and helpful. Use markdown formatting.',
      ].join('\n');

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      return text || null;
    } catch (err) {
      console.warn(`[ConversationEngine] AI response failed: ${(err as Error).message}`);
      return null;
    }
  }
}
