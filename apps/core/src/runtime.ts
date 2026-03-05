import { EventEmitter } from 'node:events';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { CoreInfo, MessageEnvelope } from '@nexus-core/protocol';
import { createEvent } from '@nexus-core/protocol';

import { CoreDatabase } from './database.js';
import { MessageRouter } from './message-router.js';
import { ProjectManager } from './managers/project-manager.js';
import { WorkspaceManager } from './managers/workspace-manager.js';
import { AgentManager } from './managers/agent-manager.js';
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

  // Managers
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

    // Init managers
    this.projectManager = new ProjectManager(this.db, this.emitter);
    this.workspaceManager = new WorkspaceManager(this.db, this.emitter);
    this.agentManager = new AgentManager(this.db, this.emitter);
    this.gitTracker = new GitTracker();
    this.fileManager = new FileManager(this.emitter);
    this.terminalManager = new TerminalManager(this.emitter);

    // Init async managers
    await this.terminalManager.init();
    await this.fileManager.init();

    // Init router & register routes
    this.router = new MessageRouter();
    this.registerRoutes();

    // Init connection manager & start WS server
    this.connectionManager = new ConnectionManager(this.router, this.emitter, {
      devMode: this.config.devMode ?? true,
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

    // ── project namespace ────────────────────────────────────────────────────
    r.register('project', 'list', async () => ({
      projects: this.projectManager.listProjects(),
    }));

    r.register('project', 'create', async (payload) => {
      const p = payload as { name: string; path: string };
      return this.projectManager.addProject(p.name, p.path);
    });

    r.register('project', 'delete', async (payload) => {
      const p = payload as { projectId: string };
      const deleted = this.projectManager.removeProject(p.projectId);
      return { projectId: p.projectId, deleted };
    });

    // ── workspace namespace ──────────────────────────────────────────────────
    r.register('workspace', 'create', async (payload) => {
      const p = payload as { projectId: string; name: string; branch?: string; agentProvider?: string };
      return this.workspaceManager.createWorkspace(p.projectId, p.name, p.branch, p.agentProvider);
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
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private resolveWorkspacePath(workspaceId: string): string {
    const workspace = this.workspaceManager.getWorkspace(workspaceId);
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

    const project = this.projectManager.getProject(workspace.projectId);
    if (!project) throw new Error(`Project ${workspace.projectId} not found`);

    return project.path;
  }
}
