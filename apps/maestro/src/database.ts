/**
 * SQLite persistence layer for Maestro.
 * Users, sessions, registered Cores, AI config, settings.
 */
import Database from 'better-sqlite3';

export interface MaestroDatabaseOptions {
  path: string;
  verbose?: boolean;
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'user';
  totp_secret: string | null;
  totp_enabled: number;
  created_at: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface CoreRow {
  id: string;
  core_id: string;
  display_name: string;
  access_token: string;
  status: 'online' | 'offline';
  last_heartbeat: string | null;
  tunnel_url: string | null;
  totp_secret: string | null;
  totp_enabled: number;
  connection_mode: 'inbound' | 'outbound';
  created_at: string;
}

export class MaestroDatabase {
  readonly db: Database.Database;

  constructor(opts: MaestroDatabaseOptions) {
    this.db = new Database(opts.path, {
      verbose: opts.verbose ? console.log : undefined,
    });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id              TEXT PRIMARY KEY,
        username        TEXT NOT NULL UNIQUE,
        password_hash   TEXT NOT NULL,
        salt            TEXT NOT NULL,
        role            TEXT NOT NULL DEFAULT 'user',
        totp_secret     TEXT,
        totp_enabled    INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token       TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cores (
        id              TEXT PRIMARY KEY,
        core_id         TEXT NOT NULL,
        display_name    TEXT NOT NULL,
        access_token    TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'offline',
        last_heartbeat  TEXT,
        tunnel_url      TEXT,
        totp_secret     TEXT,
        totp_enabled    INTEGER NOT NULL DEFAULT 0,
        connection_mode TEXT NOT NULL DEFAULT 'inbound',
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ai_config (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Migration: add new columns for existing DBs
      -- (CREATE TABLE IF NOT EXISTS won't add columns to existing tables)
    `);

    // Safe migrations — each wrapped in try/catch for idempotency
    for (const col of [
      'ALTER TABLE cores ADD COLUMN tunnel_url TEXT',
      'ALTER TABLE cores ADD COLUMN totp_secret TEXT',
      'ALTER TABLE cores ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE cores ADD COLUMN connection_mode TEXT NOT NULL DEFAULT 'inbound'",
    ]) {
      try {
        this.db.exec(col);
      } catch {
        /* already exists */
      }
    }

    this.db.exec(`
      -- Performance indices
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_cores_core_id ON cores(core_id);
      CREATE INDEX IF NOT EXISTS idx_cores_access_token ON cores(access_token);
      CREATE INDEX IF NOT EXISTS idx_cores_status ON cores(status);
    `);
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  insertUser(
    id: string,
    username: string,
    passwordHash: string,
    salt: string,
    role: 'admin' | 'user',
  ): void {
    this.db
      .prepare('INSERT INTO users (id, username, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)')
      .run(id, username, passwordHash, salt, role);
  }

  getUserByUsername(username: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | UserRow
      | undefined;
  }

  getUser(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  listUsers(): UserRow[] {
    return this.db.prepare('SELECT * FROM users ORDER BY created_at').all() as UserRow[];
  }

  deleteUser(id: string): boolean {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  updateUserPassword(id: string, passwordHash: string, salt: string): void {
    this.db
      .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
      .run(passwordHash, salt, id);
  }

  updateUserTotp(id: string, secret: string | null, enabled: boolean): void {
    this.db
      .prepare('UPDATE users SET totp_secret = ?, totp_enabled = ? WHERE id = ?')
      .run(secret, enabled ? 1 : 0, id);
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  insertSession(token: string, userId: string, expiresAt: string): void {
    this.db
      .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, userId, expiresAt);
  }

  getSession(
    token: string,
  ): (SessionRow & { username: string; role: 'admin' | 'user' }) | undefined {
    return this.db
      .prepare(
        `SELECT s.*, u.username, u.role FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`,
      )
      .get(token) as (SessionRow & { username: string; role: 'admin' | 'user' }) | undefined;
  }

  deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  deleteExpiredSessions(): void {
    this.db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  }

  // ─── Cores ────────────────────────────────────────────────────────────────

  insertCore(id: string, coreId: string, displayName: string, accessToken: string): void {
    this.db
      .prepare('INSERT INTO cores (id, core_id, display_name, access_token) VALUES (?, ?, ?, ?)')
      .run(id, coreId, displayName, accessToken);
  }

  getCore(id: string): CoreRow | undefined {
    return this.db.prepare('SELECT * FROM cores WHERE id = ?').get(id) as CoreRow | undefined;
  }

  getCoreByAccessToken(accessToken: string): CoreRow | undefined {
    return this.db.prepare('SELECT * FROM cores WHERE access_token = ?').get(accessToken) as
      | CoreRow
      | undefined;
  }

  getCoreByCoreId(coreId: string): CoreRow | undefined {
    return this.db.prepare('SELECT * FROM cores WHERE core_id = ?').get(coreId) as
      | CoreRow
      | undefined;
  }

  listCores(): CoreRow[] {
    return this.db.prepare('SELECT * FROM cores ORDER BY created_at').all() as CoreRow[];
  }

  updateCoreStatus(id: string, status: 'online' | 'offline'): void {
    this.db
      .prepare("UPDATE cores SET status = ?, last_heartbeat = datetime('now') WHERE id = ?")
      .run(status, id);
  }

  updateCoreDisplayName(id: string, displayName: string): void {
    this.db.prepare('UPDATE cores SET display_name = ? WHERE id = ?').run(displayName, id);
  }

  updateCoreAccessToken(id: string, accessToken: string): void {
    this.db.prepare('UPDATE cores SET access_token = ? WHERE id = ?').run(accessToken, id);
  }

  deleteCore(id: string): boolean {
    const result = this.db.prepare('DELETE FROM cores WHERE id = ?').run(id);
    return result.changes > 0;
  }

  updateCoreTunnelUrl(id: string, tunnelUrl: string | null): void {
    this.db
      .prepare('UPDATE cores SET tunnel_url = ?, connection_mode = ? WHERE id = ?')
      .run(tunnelUrl, tunnelUrl ? 'outbound' : 'inbound', id);
  }

  updateCoreTotp(id: string, secret: string | null, enabled: boolean): void {
    this.db
      .prepare('UPDATE cores SET totp_secret = ?, totp_enabled = ? WHERE id = ?')
      .run(secret, enabled ? 1 : 0, id);
  }

  getOutboundCores(): CoreRow[] {
    return this.db
      .prepare("SELECT * FROM cores WHERE connection_mode = 'outbound' AND tunnel_url IS NOT NULL")
      .all() as CoreRow[];
  }

  // ─── AI Config ────────────────────────────────────────────────────────────

  getAiConfig(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM ai_config WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setAiConfig(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO ai_config (key, value) VALUES (?, ?)
         ON CONFLICT(key)
         DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      )
      .run(key, value);
  }

  getAllAiConfig(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM ai_config ORDER BY key').all() as {
      key: string;
      value: string;
    }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key)
         DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      )
      .run(key, value);
  }

  close(): void {
    this.db.close();
  }
}
