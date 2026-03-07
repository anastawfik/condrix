import { EventEmitter } from 'node:events';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { CoreInfo, MessageEnvelope } from '@nexus-core/protocol';
import { createEvent } from '@nexus-core/protocol';

import { CoreDatabase } from './database.js';
import { AuthManager } from './auth.js';
import { MessageRouter } from './message-router.js';
import { ProjectManager } from './managers/project-manager.js';
import { WorkspaceManager } from './managers/workspace-manager.js';
import { AgentManager, type WorkspaceContextProvider } from './managers/agent-manager.js';
import { ClaudeProvider } from './providers/claude-provider.js';
import { OAuthTokenManager } from './services/oauth-token-manager.js';
import { ConnectionManager } from './managers/connection-manager.js';
import { TerminalManager } from './managers/terminal-manager.js';
import { FileManager } from './managers/file-manager.js';
import { GitTracker } from './managers/git-tracker.js';

export interface CoreConfig {
  coreId: string;
  displayName: string;
  host: string;
  port: number;
  dbPath?: string;
  devMode?: boolean;
}

/**
 * Central orchestrator within a Core.
 * Initializes all managers, handles configuration, manages the WebSocket server,
 * and routes messages between internal components and external clients/Maestro.
 */
export class CoreRuntime {
  private config: CoreConfig;
  private running = false;
  private startedAt = 0;

  // Infrastructure
  private db!: CoreDatabase;
  private emitter!: EventEmitter;
  private router!: MessageRouter;

  // Services
  private oauthManager!: OAuthTokenManager;

  // Managers
  private authManager!: AuthManager;
  private projectManager!: ProjectManager;
  private workspaceManager!: WorkspaceManager;
  private agentManager!: AgentManager;
  private connectionManager!: ConnectionManager;
  private terminalManager!: TerminalManager;
  private fileManager!: FileManager;
  private gitTracker!: GitTracker;

  constructor(config: CoreConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.startedAt = Date.now();

    // Init database
    const dbDir = join(homedir(), '.nexuscore');
    mkdirSync(dbDir, { recursive: true });
    const dbPath = this.config.dbPath ?? join(dbDir, 'core.db');
    this.db = new CoreDatabase({ path: dbPath });

    // Init event bus
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);

    // Init auth manager
    this.authManager = new AuthManager(this.db.db);
    const devMode = this.config.devMode ?? true;
    if (!devMode) {
      const defaultToken = this.authManager.ensureDefaultToken();
      if (defaultToken) {
        console.log(`[Core] Auth token generated (save this!):\n  ${defaultToken.token}`);
      }
    }

    // Init managers
    this.projectManager = new ProjectManager(this.db, this.emitter);
    this.workspaceManager = new WorkspaceManager(this.db, this.emitter);
    this.workspaceManager.setProjectManager(this.projectManager);
    this.agentManager = new AgentManager(this.db, this.emitter);

    // Init OAuth token manager + Claude provider
    this.oauthManager = new OAuthTokenManager(this.db);
    this.oauthManager.onTokenRefreshed = (accessToken) => {
      const claude = this.agentManager.getProvider('claude') as ClaudeProvider | undefined;
      if (claude) {
        claude.reconfigure({ authToken: accessToken });
        console.log('[Core] Claude provider reconfigured with refreshed OAuth token');
      } else {
        // No provider yet — create one with the new token
        this.reinitClaudeProvider();
      }
    };
    this.oauthManager.onLoginComplete = (result) => {
      if (result.success) {
        this.reinitClaudeProvider();
      }
      this.emitter.emit('core:oauthComplete', result);
    };
    await this.initClaudeProvider();

    this.gitTracker = new GitTracker();
    this.fileManager = new FileManager(this.emitter);
    this.terminalManager = new TerminalManager(this.emitter);

    // Init async managers
    await this.terminalManager.init();
    await this.fileManager.init();

    // Wire workspace context into agent manager
    this.agentManager.setContextProvider(this.createContextProvider());

    // Init router & register routes
    this.router = new MessageRouter();
    this.registerRoutes();

    // Init connection manager & start WS server
    this.connectionManager = new ConnectionManager(this.router, this.emitter, {
      devMode,
      authManager: this.authManager,
    });
    await this.connectionManager.start(this.config.host, this.config.port);

    // Wire event broadcasting
    this.wireEventBroadcasting();

    this.running = true;
    console.log(`[Core] ${this.config.displayName} started on ${this.config.host}:${this.config.port}`);
  }

  async stop(): Promise<void> {
    console.log(`[Core] ${this.config.displayName} stopping...`);

    // Reverse order shutdown
    this.oauthManager?.destroy();
    this.terminalManager?.closeAll();
    await this.fileManager?.closeAll();
    await this.connectionManager?.stop();
    this.db?.close();

    this.running = false;
    console.log(`[Core] ${this.config.displayName} stopped`);
  }

  getInfo(): CoreInfo {
    return {
      coreId: this.config.coreId,
      displayName: this.config.displayName,
      host: this.config.host,
      port: this.config.port,
      status: this.running ? 'online' : 'offline',
      lastHeartbeat: new Date().toISOString(),
    };
  }

  // ─── Route Registration ────────────────────────────────────────────────────

  private registerRoutes(): void {
    const r = this.router;

    // ── core namespace ───────────────────────────────────────────────────────
    r.register('core', 'info', async () => this.getInfo());

    r.register('core', 'health', async () => ({
      healthy: this.running,
      uptime: (Date.now() - this.startedAt) / 1000,
      memoryUsage: process.memoryUsage().heapUsed,
      activeWorkspaces: this.workspaceManager
        .listWorkspaces()
        .filter((ws) => ws.state === 'ACTIVE').length,
    }));

    r.register('core', 'browse', async (payload) => {
      const p = payload as { path?: string; depth?: number };
      const browsePath = p.path ?? homedir();
      const entries = await this.fileManager.browseDirectory(browsePath, p.depth ?? 1);
      return { path: resolve(browsePath).replace(/\\/g, '/'), entries };
    });

    // ── config routes ─────────────────────────────────────────────────────
    r.register('core', 'config.get', async (payload) => {
      const p = payload as { key: string };
      const value = this.db.getSetting(p.key);
      return { key: p.key, value: this.maskSensitive(p.key, value) };
    });

    r.register('core', 'config.set', async (payload) => {
      const p = payload as { key: string; value: unknown };
      this.db.setSetting(p.key, p.value);
      this.applySettingChange(p.key, p.value);
      return { key: p.key, value: this.maskSensitive(p.key, p.value) };
    });

    r.register('core', 'config.list', async (payload) => {
      const p = payload as { prefix?: string };
      const raw = p.prefix
        ? this.db.getSettingsByPrefix(p.prefix)
        : this.db.getAllSettings();
      const settings: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(raw)) {
        settings[key] = this.maskSensitive(key, value);
      }
      return { settings };
    });

    // ── OAuth routes ───────────────────────────────────────────────────────
    r.register('core', 'config.importOAuth', async () => {
      return this.oauthManager.importFromClaudeCode();
    });

    r.register('core', 'config.refreshOAuth', async () => {
      try {
        await this.oauthManager.refreshAccessToken();
        const status = this.oauthManager.getStatus();
        return { success: true, expiresAt: status.expiresAt };
      } catch (err) {
        return { success: false, expiresAt: undefined };
      }
    });

    r.register('core', 'config.oauthStatus', async () => {
      return this.oauthManager.getStatus();
    });

    r.register('core', 'oauth.login', async () => {
      const { url, completion } = await this.oauthManager.startBrowserLogin();
      // Handle the completion asynchronously — don't block the response
      completion.then((result) => {
        if (this.oauthManager.onLoginComplete) {
          this.oauthManager.onLoginComplete(result);
        }
      });
      return { url };
    });

    // ── project namespace ────────────────────────────────────────────────────
    r.register('project', 'list', async () => ({
      projects: this.projectManager.listProjects(),
    }));

    r.register('project', 'create', async (payload) => {
      const p = payload as { name: string; path?: string; url?: string };
      return this.projectManager.addProject(p.name, p.path ?? '', p.url);
    });

    r.register('project', 'delete', async (payload) => {
      const p = payload as { projectId: string };
      const deleted = this.projectManager.removeProject(p.projectId);
      return { projectId: p.projectId, deleted };
    });

    // ── workspace namespace ──────────────────────────────────────────────────
    r.register('workspace', 'create', async (payload) => {
      const p = payload as { projectId: string; name: string; branch?: string; agentProvider?: string };
      return await this.workspaceManager.createWorkspace(p.projectId, p.name, p.branch, p.agentProvider);
    });

    r.register('workspace', 'list', async (payload) => {
      const p = payload as { projectId?: string };
      return { workspaces: this.workspaceManager.listWorkspaces(p.projectId) };
    });

    r.register('workspace', 'enter', async (payload) => {
      const p = payload as { workspaceId: string };
      return this.workspaceManager.transitionState(p.workspaceId, 'ACTIVE');
    });

    r.register('workspace', 'suspend', async (payload) => {
      const p = payload as { workspaceId: string };
      const ws = this.workspaceManager.transitionState(p.workspaceId, 'SUSPENDED');
      return { workspaceId: ws.id, state: ws.state };
    });

    r.register('workspace', 'resume', async (payload) => {
      const p = payload as { workspaceId: string };
      return this.workspaceManager.transitionState(p.workspaceId, 'IDLE');
    });

    r.register('workspace', 'destroy', async (payload) => {
      const p = payload as { workspaceId: string };
      const destroyed = this.workspaceManager.destroyWorkspace(p.workspaceId);
      return { workspaceId: p.workspaceId, destroyed };
    });

    // ── agent namespace ──────────────────────────────────────────────────────
    r.register('agent', 'chat', async (payload) => {
      const p = payload as { workspaceId: string; message: string };
      return this.agentManager.sendMessage(p.workspaceId, p.message);
    });

    r.register('agent', 'cancel', async (payload) => {
      const p = payload as { workspaceId: string };
      const cancelled = this.agentManager.cancelSession(p.workspaceId);
      return { cancelled };
    });

    r.register('agent', 'history', async (payload) => {
      const p = payload as { workspaceId: string; limit?: number; before?: string };
      return this.agentManager.getHistory(p.workspaceId, p.limit, p.before);
    });

    // ── terminal namespace ───────────────────────────────────────────────────
    r.register('terminal', 'create', async (payload) => {
      const p = payload as { workspaceId: string; shell?: string; cols?: number; rows?: number };
      const projectPath = this.resolveWorkspacePath(p.workspaceId);
      return this.terminalManager.createTerminal(p.workspaceId, p.shell, p.cols, p.rows, projectPath);
    });

    r.register('terminal', 'write', async (payload) => {
      const p = payload as { terminalId: string; data: string };
      this.terminalManager.writeToTerminal(p.terminalId, p.data);
      return { written: true };
    });

    r.register('terminal', 'resize', async (payload) => {
      const p = payload as { terminalId: string; cols: number; rows: number };
      this.terminalManager.resizeTerminal(p.terminalId, p.cols, p.rows);
      return { resized: true };
    });

    r.register('terminal', 'close', async (payload) => {
      const p = payload as { terminalId: string };
      this.terminalManager.closeTerminal(p.terminalId);
      return { closed: true };
    });

    r.register('terminal', 'list', async (payload) => {
      const p = payload as { workspaceId?: string };
      return { terminals: this.terminalManager.listTerminals(p.workspaceId) };
    });

    // ── file namespace ───────────────────────────────────────────────────────
    r.register('file', 'tree', async (payload) => {
      const p = payload as { workspaceId: string; path?: string; depth?: number };
      const rootPath = this.resolveWorkspacePath(p.workspaceId);
      const dirPath = p.path ? join(rootPath, p.path) : rootPath;
      const entries = await this.fileManager.listDirectory(dirPath, p.depth ?? 2);
      return { entries };
    });

    r.register('file', 'read', async (payload) => {
      const p = payload as { workspaceId: string; path: string; encoding?: string };
      const rootPath = this.resolveWorkspacePath(p.workspaceId);
      const fullPath = join(rootPath, p.path);
      const content = await this.fileManager.readFileContent(fullPath);
      return { path: p.path, content, encoding: p.encoding ?? 'utf-8' };
    });

    r.register('file', 'write', async (payload) => {
      const p = payload as { workspaceId: string; path: string; content: string; createDirs?: boolean };
      const rootPath = this.resolveWorkspacePath(p.workspaceId);
      const fullPath = join(rootPath, p.path);
      await this.fileManager.writeFileContent(fullPath, p.content, p.createDirs);
      return { path: p.path, written: true };
    });

    r.register('file', 'search', async (payload) => {
      const p = payload as { workspaceId: string; pattern: string; path?: string; maxResults?: number };
      const rootPath = this.resolveWorkspacePath(p.workspaceId);
      const searchPath = p.path ? join(rootPath, p.path) : rootPath;
      const matches = await this.fileManager.searchFiles(searchPath, p.pattern, p.maxResults);
      return { matches };
    });

    r.register('file', 'watch', async (payload) => {
      const p = payload as { workspaceId: string; paths: string[] };
      const rootPath = this.resolveWorkspacePath(p.workspaceId);
      for (const watchPath of p.paths) {
        await this.fileManager.watchDirectory(join(rootPath, watchPath), p.workspaceId);
      }
      return { watching: true, paths: p.paths };
    });

    // ── git namespace ────────────────────────────────────────────────────────
    r.register('git', 'status', async (payload) => {
      const p = payload as { workspaceId: string };
      const repoPath = this.resolveWorkspacePath(p.workspaceId);
      return this.gitTracker.getStatus(repoPath);
    });

    r.register('git', 'diff', async (payload) => {
      const p = payload as { workspaceId: string; staged?: boolean; path?: string };
      const repoPath = this.resolveWorkspacePath(p.workspaceId);
      return this.gitTracker.getDiff(repoPath, p.staged, p.path);
    });

    r.register('git', 'log', async (payload) => {
      const p = payload as { workspaceId: string; limit?: number; branch?: string };
      const repoPath = this.resolveWorkspacePath(p.workspaceId);
      return this.gitTracker.getLog(repoPath, p.limit, p.branch);
    });

    r.register('git', 'stage', async (payload) => {
      const p = payload as { workspaceId: string; paths: string[] };
      const repoPath = this.resolveWorkspacePath(p.workspaceId);
      const staged = await this.gitTracker.stage(repoPath, p.paths);
      return { staged };
    });

    r.register('git', 'commit', async (payload) => {
      const p = payload as { workspaceId: string; message: string };
      const repoPath = this.resolveWorkspacePath(p.workspaceId);
      return this.gitTracker.commit(repoPath, p.message);
    });

    r.register('git', 'branch', async (payload) => {
      const p = payload as { workspaceId: string };
      const repoPath = this.resolveWorkspacePath(p.workspaceId);
      return this.gitTracker.getBranches(repoPath);
    });
  }

  // ─── Event Broadcasting ────────────────────────────────────────────────────

  private wireEventBroadcasting(): void {
    const eventMappings: [string, string, string][] = [
      ['project:created', 'project', 'created'],
      ['project:deleted', 'project', 'deleted'],
      ['workspace:created', 'workspace', 'created'],
      ['workspace:stateChanged', 'workspace', 'stateChanged'],
      ['workspace:destroyed', 'workspace', 'destroyed'],
      ['agent:message', 'agent', 'message'],
      ['terminal:output', 'terminal', 'output'],
      ['terminal:exit', 'terminal', 'exit'],
      ['terminal:created', 'terminal', 'created'],
      ['file:changed', 'file', 'changed'],
      ['core:oauthComplete', 'core', 'oauthComplete'],
    ];

    for (const [emitterEvent, namespace, action] of eventMappings) {
      this.emitter.on(emitterEvent, (payload: unknown) => {
        this.db.insertEvent(namespace, action, payload);
        const event = createEvent(
          namespace as Parameters<typeof createEvent>[0],
          action as never,
          payload as never,
        );
        this.connectionManager.broadcast(event);
      });
    }

    // Streaming events — broadcast only, don't persist to DB
    const streamEvents: [string, string, string][] = [
      ['agent:thinkingDelta', 'agent', 'thinkingDelta'],
      ['agent:textDelta', 'agent', 'textDelta'],
    ];
    for (const [emitterEvent, namespace, action] of streamEvents) {
      this.emitter.on(emitterEvent, (payload: unknown) => {
        const event = createEvent(
          namespace as Parameters<typeof createEvent>[0],
          action as never,
          payload as never,
        );
        this.connectionManager.broadcast(event);
      });
    }
  }

  // ─── Settings / Provider ──────────────────────────────────────────────────

  private async initClaudeProvider(): Promise<void> {
    // DB settings take priority, env vars as fallback
    const dbApiKey = this.db.getSetting('model.apiKey') as string | undefined;
    const dbModel = this.db.getSetting('model.id') as string | undefined;
    const dbMaxTokens = this.db.getSetting('model.maxTokens') as number | undefined;
    const dbSystemPrompt = this.db.getSetting('model.systemPrompt') as string | undefined;
    const dbAuthMethod = this.db.getSetting('auth.method') as string | undefined;

    const model = dbModel ?? process.env.NEXUS_CLAUDE_MODEL;
    const systemPrompt = dbSystemPrompt ?? process.env.NEXUS_CLAUDE_SYSTEM_PROMPT;
    const apiKey = dbApiKey ?? process.env.ANTHROPIC_API_KEY;

    // OAuth takes precedence when auth.method is 'oauth'
    if (dbAuthMethod === 'oauth') {
      // Get a valid access token (refreshes if expired)
      const accessToken = await this.oauthManager.getAccessToken();
      if (accessToken) {
        const claude = new ClaudeProvider({
          authToken: accessToken,
          apiKey, // fallback if OAuth fails
          model,
          maxTokens: dbMaxTokens,
          systemPrompt,
        });
        this.agentManager.registerProvider(claude);
        this.agentManager.setDefaultProvider('claude');
        console.log(`[Core] Claude provider registered via OAuth (model: ${model ?? 'claude-sonnet-4-5'})`);
        return;
      }
      console.warn('[Core] OAuth configured but no valid token available — trying API key');
    }

    // API key authentication
    if (apiKey) {
      const claude = new ClaudeProvider({
        apiKey,
        model,
        maxTokens: dbMaxTokens,
        systemPrompt,
      });
      this.agentManager.registerProvider(claude);
      this.agentManager.setDefaultProvider('claude');
      console.log(`[Core] Claude provider registered (model: ${model ?? 'claude-sonnet-4-5'})`);
    } else {
      console.log('[Core] No authentication configured — using echo provider');
      console.log('[Core] Sign in via Settings → Model → "Sign in with Claude" or set an API key');
    }
  }

  private applySettingChange(key: string, value: unknown): void {
    // Handle auth method switch
    if (key === 'auth.method') {
      this.reinitClaudeProvider();
      return;
    }

    // Handle OAuth token changes
    if (key.startsWith('oauth.')) {
      // Provider will be reconfigured via onTokenRefreshed callback or reinit
      if (key === 'oauth.accessToken') {
        const claude = this.agentManager.getProvider('claude') as ClaudeProvider | undefined;
        const authMethod = this.db.getSetting('auth.method') as string | undefined;
        if (authMethod === 'oauth' && claude && value) {
          claude.reconfigure({ authToken: value as string });
          console.log('[Core] Claude provider reconfigured with new OAuth token');
        }
      }
      return;
    }

    // Handle model.* settings
    if (!key.startsWith('model.')) return;

    const claude = this.agentManager.getProvider('claude') as ClaudeProvider | undefined;

    if (claude) {
      // Reconfigure existing provider
      const configMap: Record<string, string> = {
        'model.apiKey': 'apiKey',
        'model.id': 'model',
        'model.maxTokens': 'maxTokens',
        'model.systemPrompt': 'systemPrompt',
      };
      const configKey = configMap[key];
      if (configKey) {
        claude.reconfigure({ [configKey]: value });
        console.log(`[Core] Claude provider reconfigured: ${key}`);
      }
    } else if (key === 'model.apiKey' && value) {
      // No provider yet — create one with all saved settings
      this.reinitClaudeProvider();
    }
  }

  /** Re-initialize the Claude provider from current DB settings (used on auth method switch / login). */
  private reinitClaudeProvider(): void {
    const settings = this.db.getSettingsByPrefix('model.');
    const authMethod = (this.db.getSetting('auth.method') as string) ?? 'apikey';
    const accessToken = this.db.getSetting('oauth.accessToken') as string | undefined;

    const model = settings['model.id'] as string | undefined;
    const maxTokens = settings['model.maxTokens'] as number | undefined;
    const systemPrompt = settings['model.systemPrompt'] as string | undefined;

    const apiKey = (settings['model.apiKey'] as string | undefined) ?? process.env.ANTHROPIC_API_KEY;
    if (authMethod === 'oauth' && accessToken) {
      const claude = new ClaudeProvider({ authToken: accessToken, apiKey, model, maxTokens, systemPrompt });
      this.agentManager.registerProvider(claude);
      this.agentManager.setDefaultProvider('claude');
      console.log('[Core] Claude provider (re)created with OAuth');
    } else if (apiKey) {
      const claude = new ClaudeProvider({ apiKey, model, maxTokens, systemPrompt });
      this.agentManager.registerProvider(claude);
      this.agentManager.setDefaultProvider('claude');
      console.log('[Core] Claude provider (re)created with API key');
    }
  }

  private static readonly SENSITIVE_KEYS = new Set([
    'model.apiKey',
    'oauth.accessToken',
    'oauth.refreshToken',
  ]);

  private maskSensitive(key: string, value: unknown): unknown {
    if (CoreRuntime.SENSITIVE_KEYS.has(key) && typeof value === 'string' && value.length > 4) {
      return '\u2022\u2022\u2022\u2022' + value.slice(-4);
    }
    return value;
  }

  // ─── Workspace Context ─────────────────────────────────────────────────────

  private createContextProvider(): WorkspaceContextProvider {
    const runtime = this;
    return {
      async buildContext(workspaceId: string): Promise<string | null> {
        const workspace = runtime.workspaceManager.getWorkspace(workspaceId);
        if (!workspace) return null;

        const project = runtime.projectManager.getProject(workspace.projectId);
        if (!project) return null;

        const workDir = workspace.workDir ?? project.path;
        if (!workDir) return null;

        const parts: string[] = [];
        parts.push(`# Workspace Context`);
        parts.push(`Project: ${project.name}`);
        parts.push(`Branch: ${workspace.branch ?? 'unknown'}`);
        parts.push(`Working directory: ${workDir}`);

        // Build directory tree (depth 3 for a useful overview)
        try {
          const entries = await runtime.fileManager.listDirectory(workDir, 3);
          if (entries.length > 0) {
            parts.push('');
            parts.push('## File Tree');
            parts.push('```');
            for (const entry of entries) {
              const prefix = entry.type === 'directory' ? '\u{1F4C1} ' : '  ';
              parts.push(`${prefix}${entry.path}`);
            }
            parts.push('```');
          }
        } catch {
          // Directory listing may fail — non-critical
        }

        // Try to include key config files for additional context
        const keyFiles = ['package.json', 'CLAUDE.md', 'README.md'];
        for (const filename of keyFiles) {
          try {
            const content = await runtime.fileManager.readFileContent(
              join(workDir, filename),
            );
            if (content && content.length < 4000) {
              parts.push('');
              parts.push(`## ${filename}`);
              parts.push('```');
              parts.push(content.trim());
              parts.push('```');
            }
          } catch {
            // File doesn't exist — skip
          }
        }

        return parts.join('\n');
      },
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private resolveWorkspacePath(workspaceId: string): string {
    const workspace = this.workspaceManager.getWorkspace(workspaceId);
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

    // Prefer workspace's own cloned directory
    if (workspace.workDir) {
      return workspace.workDir;
    }

    // Fallback to project path for backward compatibility
    const project = this.projectManager.getProject(workspace.projectId);
    if (!project) throw new Error(`Project ${workspace.projectId} not found`);

    return project.path;
  }
}
