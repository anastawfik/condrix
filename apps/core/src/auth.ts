/**
 * Token-based authentication manager for Core.
 * Generates, validates, and manages auth tokens stored in SQLite.
 * Supports optional TOTP 2FA per token for enhanced security.
 */
import { randomBytes, createHmac } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { AuthScope } from '@condrix/protocol';

const ALL_SCOPES: AuthScope[] = [
  'read:files',
  'write:files',
  'exec:terminal',
  'admin:workspace',
  'admin:project',
  'admin:core',
  'chat:agent',
  'chat:maestro',
];

export interface AuthToken {
  token: string;
  name: string;
  scopes: AuthScope[];
  createdAt: string;
  expiresAt: string | null;
  totpEnabled: boolean;
}

interface AuthTokenRow {
  token: string;
  name: string;
  scopes: string;
  created_at: string;
  expires_at: string | null;
  totp_secret: string | null;
  totp_enabled: number;
}

export class AuthManager {
  constructor(private db: Database.Database) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        token         TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        scopes        TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at    TEXT,
        totp_secret   TEXT,
        totp_enabled  INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Migration: add TOTP columns if they don't exist (for existing DBs)
    try {
      this.db.exec(`ALTER TABLE auth_tokens ADD COLUMN totp_secret TEXT`);
    } catch {
      /* column already exists */
    }
    try {
      this.db.exec(`ALTER TABLE auth_tokens ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`);
    } catch {
      /* column already exists */
    }
  }

  generateToken(name: string, scopes?: AuthScope[]): AuthToken {
    const token = `nxc_${randomBytes(32).toString('hex')}`;
    const tokenScopes = scopes ?? [...ALL_SCOPES];
    const now = new Date().toISOString();

    this.db
      .prepare('INSERT INTO auth_tokens (token, name, scopes, created_at) VALUES (?, ?, ?, ?)')
      .run(token, name, JSON.stringify(tokenScopes), now);

    return {
      token,
      name,
      scopes: tokenScopes,
      createdAt: now,
      expiresAt: null,
      totpEnabled: false,
    };
  }

  validateToken(token: string): { valid: boolean; scopes: AuthScope[]; totpEnabled: boolean } {
    const row = this.db.prepare('SELECT * FROM auth_tokens WHERE token = ?').get(token) as
      | AuthTokenRow
      | undefined;

    if (!row) return { valid: false, scopes: [], totpEnabled: false };

    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { valid: false, scopes: [], totpEnabled: false };
    }

    const scopes = JSON.parse(row.scopes) as AuthScope[];
    return { valid: true, scopes, totpEnabled: row.totp_enabled === 1 };
  }

  // ─── TOTP 2FA ──────────────────────────────────────────────────────────────

  /**
   * Set up TOTP for a token. Returns the secret and OTP auth URI.
   * TOTP is not enabled until `enableTotp()` is called with a valid code.
   */
  setupTotp(tokenName: string): { secret: string; otpauthUri: string } | null {
    const row = this.db.prepare('SELECT * FROM auth_tokens WHERE name = ?').get(tokenName) as
      | AuthTokenRow
      | undefined;
    if (!row) return null;

    const secret = randomBytes(20).toString('hex');
    this.db
      .prepare('UPDATE auth_tokens SET totp_secret = ?, totp_enabled = 0 WHERE name = ?')
      .run(secret, tokenName);

    const base32Secret = this.hexToBase32(secret);
    const otpauthUri = `otpauth://totp/Condrix:${tokenName}?secret=${base32Secret}&issuer=Condrix&algorithm=SHA1&digits=6&period=30`;

    return { secret: base32Secret, otpauthUri };
  }

  /**
   * Verify a TOTP code and enable 2FA for the token if correct.
   */
  enableTotp(tokenName: string, code: string): boolean {
    const row = this.db.prepare('SELECT * FROM auth_tokens WHERE name = ?').get(tokenName) as
      | AuthTokenRow
      | undefined;
    if (!row || !row.totp_secret) return false;

    if (this.verifyTotpCode(row.totp_secret, code)) {
      this.db.prepare('UPDATE auth_tokens SET totp_enabled = 1 WHERE name = ?').run(tokenName);
      return true;
    }
    return false;
  }

  /**
   * Disable TOTP for a token.
   */
  disableTotp(tokenName: string): boolean {
    const result = this.db
      .prepare('UPDATE auth_tokens SET totp_secret = NULL, totp_enabled = 0 WHERE name = ?')
      .run(tokenName);
    return result.changes > 0;
  }

  /**
   * Verify a TOTP code against a token's secret.
   */
  verifyTokenTotp(token: string, code: string): boolean {
    const row = this.db
      .prepare('SELECT totp_secret FROM auth_tokens WHERE token = ?')
      .get(token) as { totp_secret: string | null } | undefined;
    if (!row?.totp_secret) return false;
    return this.verifyTotpCode(row.totp_secret, code);
  }

  /**
   * Get TOTP status for a token by name.
   */
  getTotpStatus(tokenName: string): { configured: boolean; enabled: boolean } {
    const row = this.db
      .prepare('SELECT totp_secret, totp_enabled FROM auth_tokens WHERE name = ?')
      .get(tokenName) as { totp_secret: string | null; totp_enabled: number } | undefined;
    if (!row) return { configured: false, enabled: false };
    return { configured: !!row.totp_secret, enabled: row.totp_enabled === 1 };
  }

  // ─── Token Management ──────────────────────────────────────────────────────

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
      totpEnabled: row.totp_enabled === 1,
    }));
  }

  revokeToken(token: string): boolean {
    const result = this.db.prepare('DELETE FROM auth_tokens WHERE token = ?').run(token);
    return result.changes > 0;
  }

  hasTokens(): boolean {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM auth_tokens').get() as {
      count: number;
    };
    return row.count > 0;
  }

  ensureDefaultToken(): AuthToken | null {
    if (this.hasTokens()) return null;
    return this.generateToken('default-admin');
  }

  // ─── TOTP Internals (RFC 6238) ─────────────────────────────────────────────

  private verifyTotpCode(secretHex: string, code: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const period = 30;

    // Check current and adjacent time steps for clock skew
    for (const offset of [-1, 0, 1]) {
      const timeStep = Math.floor(now / period) + offset;
      const generated = this.generateTotpCode(secretHex, timeStep);
      if (generated === code) return true;
    }
    return false;
  }

  private generateTotpCode(secretHex: string, timeStep: number): string {
    const secret = Buffer.from(secretHex, 'hex');
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(timeStep));

    const hmac = createHmac('sha1', secret).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const code =
      (((hmac[offset]! & 0x7f) << 24) |
        ((hmac[offset + 1]! & 0xff) << 16) |
        ((hmac[offset + 2]! & 0xff) << 8) |
        (hmac[offset + 3]! & 0xff)) %
      1000000;
    return code.toString().padStart(6, '0');
  }

  private hexToBase32(hex: string): string {
    const bytes = Buffer.from(hex, 'hex');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const byte of bytes) {
      bits += byte.toString(2).padStart(8, '0');
    }
    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.substring(i, i + 5).padEnd(5, '0');
      result += alphabet[parseInt(chunk, 2)]!;
    }
    return result;
  }
}
