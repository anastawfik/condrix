/**
 * Token-based authentication manager for Core.
 * Generates, validates, and manages auth tokens stored in SQLite.
 */
import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { AuthScope } from '@nexus-core/protocol';

const ALL_SCOPES: AuthScope[] = [
  'read:files', 'write:files', 'exec:terminal',
  'admin:workspace', 'admin:project', 'admin:core',
  'chat:agent', 'chat:maestro',
];

export interface AuthToken {
  token: string;
  name: string;
  scopes: AuthScope[];
  createdAt: string;
  expiresAt: string | null;
}

interface AuthTokenRow {
  token: string;
  name: string;
  scopes: string;
  created_at: string;
  expires_at: string | null;
}

export class AuthManager {
  constructor(private db: Database.Database) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        token       TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        scopes      TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at  TEXT
      );
    `);
  }

  generateToken(name: string, scopes?: AuthScope[]): AuthToken {
    const token = `nxc_${randomBytes(32).toString('hex')}`;
    const tokenScopes = scopes ?? [...ALL_SCOPES];
    const now = new Date().toISOString();

    this.db
      .prepare('INSERT INTO auth_tokens (token, name, scopes, created_at) VALUES (?, ?, ?, ?)')
      .run(token, name, JSON.stringify(tokenScopes), now);

    return { token, name, scopes: tokenScopes, createdAt: now, expiresAt: null };
  }

  validateToken(token: string): { valid: boolean; scopes: AuthScope[] } {
    const row = this.db
      .prepare('SELECT * FROM auth_tokens WHERE token = ?')
      .get(token) as AuthTokenRow | undefined;

    if (!row) return { valid: false, scopes: [] };

    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { valid: false, scopes: [] };
    }

    const scopes = JSON.parse(row.scopes) as AuthScope[];
    return { valid: true, scopes };
  }

  listTokens(): AuthToken[] {
    const rows = this.db
      .prepare('SELECT * FROM auth_tokens ORDER BY created_at')
      .all() as AuthTokenRow[];

    return rows.map((row) => ({
      token: row.token,
      name: row.name,
      scopes: JSON.parse(row.scopes) as AuthScope[],
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  revokeToken(token: string): boolean {
    const result = this.db
      .prepare('DELETE FROM auth_tokens WHERE token = ?')
      .run(token);
    return result.changes > 0;
  }

  hasTokens(): boolean {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM auth_tokens')
      .get() as { count: number };
    return row.count > 0;
  }

  /**
   * Ensure at least one admin token exists. Called on first run in token mode.
   * Returns the token if one was created, null if tokens already existed.
   */
  ensureDefaultToken(): AuthToken | null {
    if (this.hasTokens()) return null;
    return this.generateToken('default-admin');
  }
}
