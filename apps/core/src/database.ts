/**
 * SQLite persistence layer for Core.
 * Wraps better-sqlite3 with schema init, CRUD for projects/workspaces/conversations/events.
 */
import Database from 'better-sqlite3';
import type { ProjectInfo, WorkspaceInfo, WorkspaceState } from '@nexus-core/protocol';

export interface CoreDatabaseOptions {
  path: string;
  verbose?: boolean;
}

export class CoreDatabase {
  readonly db: Database.Database;

  constructor(opts: CoreDatabaseOptions) {
    this.db = new Database(opts.path, {
      verbose: opts.verbose ? console.log : undefined,
    });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        path        TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id              TEXT PRIMARY KEY,
        project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        state           TEXT NOT NULL DEFAULT 'CREATING',
        branch          TEXT,
        agent_provider  TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id            TEXT PRIMARY KEY,
        workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        role          TEXT NOT NULL,
        content       TEXT NOT NULL,
        timestamp     TEXT NOT NULL,
        metadata      TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        namespace  TEXT NOT NULL,
        action     TEXT NOT NULL,
        payload    TEXT NOT NULL,
        timestamp  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS agent_state (
        workspace_id  TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
        provider      TEXT NOT NULL,
        model         TEXT,
        session_data  TEXT,
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  // ─── Project CRUD ──────────────────────────────────────────────────────────

  insertProject(id: string, name: string, path: string): void {
    this.db
      .prepare('INSERT INTO projects (id, name, path) VALUES (?, ?, ?)')
      .run(id, name, path);
  }

  getProject(id: string): ProjectInfo | undefined {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as { id: string; name: string; path: string } | undefined;
    if (!row) return undefined;
    const workspaces = this.listWorkspaces(row.id);
    return { id: row.id, name: row.name, path: row.path, workspaces };
  }

  listProjects(): ProjectInfo[] {
    const rows = this.db
      .prepare('SELECT * FROM projects ORDER BY created_at')
      .all() as { id: string; name: string; path: string }[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      path: row.path,
      workspaces: this.listWorkspaces(row.id),
    }));
  }

  deleteProject(id: string): boolean {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ─── Workspace CRUD ────────────────────────────────────────────────────────

  insertWorkspace(
    id: string,
    projectId: string,
    name: string,
    state: WorkspaceState = 'CREATING',
    branch?: string,
    agentProvider?: string,
  ): void {
    this.db
      .prepare(
        'INSERT INTO workspaces (id, project_id, name, state, branch, agent_provider) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, projectId, name, state, branch ?? null, agentProvider ?? null);
  }

  getWorkspace(id: string): WorkspaceInfo | undefined {
    const row = this.db
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(id) as
      | { id: string; project_id: string; name: string; state: WorkspaceState; branch: string | null; agent_provider: string | null }
      | undefined;
    if (!row) return undefined;
    return this.toWorkspaceInfo(row);
  }

  listWorkspaces(projectId?: string): WorkspaceInfo[] {
    const rows = projectId
      ? (this.db
          .prepare('SELECT * FROM workspaces WHERE project_id = ? ORDER BY created_at')
          .all(projectId) as WorkspaceRow[])
      : (this.db
          .prepare('SELECT * FROM workspaces ORDER BY created_at')
          .all() as WorkspaceRow[]);
    return rows.map((row) => this.toWorkspaceInfo(row));
  }

  updateWorkspaceState(id: string, state: WorkspaceState): void {
    this.db
      .prepare("UPDATE workspaces SET state = ?, updated_at = datetime('now') WHERE id = ?")
      .run(state, id);
  }

  deleteWorkspace(id: string): boolean {
    const result = this.db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ─── Conversation CRUD ─────────────────────────────────────────────────────

  insertConversation(
    id: string,
    workspaceId: string,
    role: string,
    content: string,
    timestamp: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.db
      .prepare(
        'INSERT INTO conversations (id, workspace_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, workspaceId, role, content, timestamp, metadata ? JSON.stringify(metadata) : null);
  }

  getConversationHistory(
    workspaceId: string,
    limit?: number,
    before?: string,
  ): { id: string; role: string; content: string; timestamp: string; metadata?: Record<string, unknown> }[] {
    let sql = 'SELECT * FROM conversations WHERE workspace_id = ?';
    const params: unknown[] = [workspaceId];
    if (before) {
      sql += ' AND timestamp < ?';
      params.push(before);
    }
    sql += ' ORDER BY timestamp DESC';
    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    const rows = this.db.prepare(sql).all(...params) as {
      id: string;
      workspace_id: string;
      role: string;
      content: string;
      timestamp: string;
      metadata: string | null;
    }[];
    return rows.reverse().map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    }));
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  insertEvent(namespace: string, action: string, payload: unknown): void {
    this.db
      .prepare('INSERT INTO events (namespace, action, payload) VALUES (?, ?, ?)')
      .run(namespace, action, JSON.stringify(payload));
  }

  // ─── Agent State ───────────────────────────────────────────────────────────

  upsertAgentState(workspaceId: string, provider: string, model?: string, sessionData?: unknown): void {
    this.db
      .prepare(
        `INSERT INTO agent_state (workspace_id, provider, model, session_data)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(workspace_id)
         DO UPDATE SET provider = excluded.provider, model = excluded.model,
                       session_data = excluded.session_data, updated_at = datetime('now')`,
      )
      .run(workspaceId, provider, model ?? null, sessionData ? JSON.stringify(sessionData) : null);
  }

  getAgentState(workspaceId: string): { provider: string; model: string | null; sessionData: unknown } | undefined {
    const row = this.db
      .prepare('SELECT * FROM agent_state WHERE workspace_id = ?')
      .get(workspaceId) as
      | { workspace_id: string; provider: string; model: string | null; session_data: string | null }
      | undefined;
    if (!row) return undefined;
    return {
      provider: row.provider,
      model: row.model,
      sessionData: row.session_data ? JSON.parse(row.session_data) : null,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private toWorkspaceInfo(row: WorkspaceRow): WorkspaceInfo {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      state: row.state,
      ...(row.branch ? { branch: row.branch } : {}),
      ...(row.agent_provider ? { agentProvider: row.agent_provider } : {}),
    };
  }

  close(): void {
    this.db.close();
  }
}

interface WorkspaceRow {
  id: string;
  project_id: string;
  name: string;
  state: WorkspaceState;
  branch: string | null;
  agent_provider: string | null;
}
