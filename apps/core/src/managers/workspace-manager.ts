import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, existsSync, cpSync, rmSync } from 'node:fs';
import type { WorkspaceInfo, WorkspaceState } from '@condrix/protocol';
import { generateId } from '@condrix/protocol';
import { simpleGit } from 'simple-git';
import type { EventEmitter } from 'node:events';

import type { CoreDatabase } from '../database.js';
import type { ProjectManager } from './project-manager.js';

const VALID_TRANSITIONS: Record<WorkspaceState, WorkspaceState[]> = {
  CREATING: ['IDLE', 'ERRORED', 'DESTROYED'],
  IDLE: ['ACTIVE', 'SUSPENDED', 'DESTROYED'],
  ACTIVE: ['IDLE', 'WAITING', 'ERRORED', 'DESTROYED'],
  WAITING: ['ACTIVE', 'ERRORED', 'DESTROYED'],
  SUSPENDED: ['IDLE', 'DESTROYED'],
  ERRORED: ['IDLE', 'DESTROYED'],
  DESTROYED: [],
};

/** Clone operation timeout (5 minutes). */
const CLONE_TIMEOUT_MS = 5 * 60 * 1000;

/** Slugify a workspace name for use in branch names. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Manages workspace lifecycle within a project.
 * Each workspace encapsulates an isolated environment with its own agent session,
 * terminal pool, file watcher, and git tracker.
 *
 * Workspaces are cloned copies of the project repo, stored under
 * `~/.condrix/workspaces/<workspace-id>/`.
 */
export class WorkspaceManager {
  private projectManager: ProjectManager | null = null;

  constructor(
    private db: CoreDatabase,
    private emitter: EventEmitter,
  ) {}

  /** Set project manager reference (called after both are constructed). */
  setProjectManager(pm: ProjectManager): void {
    this.projectManager = pm;
  }

  async createWorkspace(
    projectId: string,
    name: string,
    branch?: string,
    agentProvider?: string,
  ): Promise<WorkspaceInfo> {
    const id = generateId('ws');
    const branchName = branch ?? `condrix/${slugify(name)}`;
    this.db.insertWorkspace(id, projectId, name, 'CREATING', branchName, agentProvider);

    try {
      const workDir = await this.setupWorkspaceDir(id, projectId, branchName);
      this.db.updateWorkspaceWorkDir(id, workDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WorkspaceManager] Failed to setup workspace: ${message}`);
      this.db.updateWorkspaceState(id, 'ERRORED');
      const workspace = this.db.getWorkspace(id)!;
      this.emitter.emit('workspace:created', workspace);
      return workspace;
    }

    this.db.updateWorkspaceState(id, 'IDLE');
    const workspace = this.db.getWorkspace(id)!;
    this.emitter.emit('workspace:created', workspace);
    return workspace;
  }

  /**
   * Set up an isolated workspace directory. Handles three cases:
   * 1. Remote URL: clone from URL
   * 2. Local git repo: clone from local path
   * 3. Local non-git directory: copy files
   */
  private async setupWorkspaceDir(
    workspaceId: string,
    projectId: string,
    branchName: string,
  ): Promise<string> {
    const project = this.db.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const workDir = join(homedir(), '.condrix', 'workspaces', workspaceId);
    mkdirSync(workDir, { recursive: true });

    // Case 1: Remote URL
    if (project.url) {
      console.log(`[WorkspaceManager] Cloning URL ${project.url} → ${workDir}`);
      await this.cloneWithTimeout(project.url, workDir);
      await this.createWorkspaceBranch(workDir, branchName);
      return workDir;
    }

    // Case 2 & 3: Local path
    if (!project.path) {
      throw new Error(`Project ${projectId} has neither a path nor a URL`);
    }

    if (!existsSync(project.path)) {
      throw new Error(`Project path does not exist: ${project.path}`);
    }

    // Check if it's a git repo
    const isGitRepo = existsSync(join(project.path, '.git'));

    if (isGitRepo) {
      console.log(`[WorkspaceManager] Cloning local repo ${project.path} → ${workDir}`);
      await this.cloneWithTimeout(project.path, workDir);
      await this.createWorkspaceBranch(workDir, branchName);
    } else {
      // Non-git directory: copy files and init a new git repo
      console.log(`[WorkspaceManager] Copying directory ${project.path} → ${workDir}`);
      cpSync(project.path, workDir, { recursive: true });

      const git = simpleGit(workDir);
      await git.init();
      await git.add('.');
      await git.commit('Initial workspace snapshot');
      await git.checkoutLocalBranch(branchName);
    }

    return workDir;
  }

  /**
   * Clone a repo with a timeout to avoid hanging on network issues.
   * Injects GITHUB_TOKEN into HTTPS GitHub URLs for private repo access.
   */
  private async cloneWithTimeout(source: string, dest: string): Promise<void> {
    const git = simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } });
    await git.clone(this.injectGitAuth(source), dest);
  }

  /**
   * Inject authentication token into HTTPS git URLs.
   * Supports GITHUB_TOKEN for github.com URLs.
   */
  private injectGitAuth(url: string): string {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return url;

    try {
      const parsed = new URL(url);
      if (
        parsed.protocol === 'https:' &&
        parsed.hostname.includes('github.com') &&
        !parsed.username
      ) {
        parsed.username = token;
        return parsed.toString();
      }
    } catch {
      // Not a valid URL (e.g. local path) — return as-is
    }
    return url;
  }

  /**
   * Create a workspace branch from the latest default branch.
   */
  private async createWorkspaceBranch(workDir: string, branchName: string): Promise<void> {
    const git = simpleGit(workDir);
    await git.fetch('origin');

    const defaultBranch = await this.detectDefaultBranch(git);
    console.log(`[WorkspaceManager] Creating branch ${branchName} from origin/${defaultBranch}`);
    await git.checkout(['-b', branchName, `origin/${defaultBranch}`]);
  }

  /**
   * Detect the default branch name by checking which of main/master exists
   * on the remote.
   */
  private async detectDefaultBranch(git: ReturnType<typeof simpleGit>): Promise<string> {
    try {
      const remoteInfo = await git.remote(['show', 'origin']);
      if (remoteInfo) {
        const match = /HEAD branch:\s*(\S+)/.exec(remoteInfo);
        if (match) {
          return match[1];
        }
      }
    } catch {
      // Fallback: check for common branch names
    }

    const branches = await git.branch(['-r']);
    if (branches.all.includes('origin/main')) return 'main';
    if (branches.all.includes('origin/master')) return 'master';

    const firstRemote = branches.all.find((b) => b.startsWith('origin/'));
    if (firstRemote) return firstRemote.replace('origin/', '');

    throw new Error('Could not detect default branch');
  }

  /** Get the working directory path for a workspace. */
  getWorkspacePath(workspaceId: string): string | undefined {
    const workspace = this.db.getWorkspace(workspaceId);
    return workspace?.workDir;
  }

  getWorkspace(id: string): WorkspaceInfo | undefined {
    return this.db.getWorkspace(id);
  }

  listWorkspaces(projectId?: string): WorkspaceInfo[] {
    return this.db.listWorkspaces(projectId);
  }

  transitionState(id: string, newState: WorkspaceState): WorkspaceInfo {
    const workspace = this.db.getWorkspace(id);
    if (!workspace) throw new Error(`Workspace ${id} not found`);

    // Idempotent — same state is a no-op
    if (workspace.state === newState) {
      return workspace;
    }

    const allowed = VALID_TRANSITIONS[workspace.state];
    if (!allowed.includes(newState)) {
      throw new Error(`Invalid transition: ${workspace.state} → ${newState}`);
    }

    const previousState = workspace.state;
    this.db.updateWorkspaceState(id, newState);
    this.emitter.emit('workspace:stateChanged', {
      workspaceId: id,
      previousState,
      newState,
    });
    return this.db.getWorkspace(id)!;
  }

  destroyWorkspace(id: string, deleteFiles = false): boolean {
    const workspace = this.db.getWorkspace(id);
    if (!workspace) return false;

    // Allow destroy from any state except DESTROYED
    if (workspace.state !== 'DESTROYED') {
      this.db.updateWorkspaceState(id, 'DESTROYED');
    }
    const deleted = this.db.deleteWorkspace(id);
    if (deleted) {
      // Optionally remove workspace directory from disk
      if (deleteFiles && workspace.workDir) {
        try {
          if (existsSync(workspace.workDir)) {
            rmSync(workspace.workDir, { recursive: true, force: true });
            console.log(`[WorkspaceManager] Deleted workspace files: ${workspace.workDir}`);
          }
        } catch (err) {
          console.warn(
            `[WorkspaceManager] Failed to delete workspace files: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
      this.emitter.emit('workspace:destroyed', { workspaceId: id });
    }
    return deleted;
  }
}

export { VALID_TRANSITIONS };
