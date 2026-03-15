/**
 * User authentication, session management, and TOTP for Maestro.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { generateId } from '@nexus-core/protocol';
import type { MaestroDatabase, UserRow } from './database.js';

const SESSION_EXPIRY_DAYS = 7;
const SCRYPT_KEYLEN = 64;

export interface SessionInfo {
  token: string;
  userId: string;
  username: string;
  role: 'admin' | 'user';
  expiresAt: string;
}

export class AuthManager {
  constructor(private db: MaestroDatabase) {}

  // ─── User Management ──────────────────────────────────────────────────────

  createUser(username: string, password: string, role: 'admin' | 'user'): string {
    const id = generateId('user');
    const salt = randomBytes(16).toString('hex');
    const hash = this.hashPassword(password, salt);
    this.db.insertUser(id, username, hash, salt, role);
    return id;
  }

  deleteUser(id: string): boolean {
    return this.db.deleteUser(id);
  }

  resetPassword(userId: string, newPassword: string): void {
    const salt = randomBytes(16).toString('hex');
    const hash = this.hashPassword(newPassword, salt);
    this.db.updateUserPassword(userId, hash, salt);
  }

  listUsers(): { id: string; username: string; role: 'admin' | 'user'; totpEnabled: boolean; createdAt: string }[] {
    return this.db.listUsers().map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      totpEnabled: u.totp_enabled === 1,
      createdAt: u.created_at,
    }));
  }

  // ─── Login / Session ──────────────────────────────────────────────────────

  login(username: string, password: string, totpCode?: string): SessionInfo | { error: string; requiresTotp?: boolean } {
    const user = this.db.getUserByUsername(username);
    if (!user) return { error: 'Invalid credentials' };

    if (!this.verifyPassword(password, user.password_hash, user.salt)) {
      return { error: 'Invalid credentials' };
    }

    if (user.totp_enabled && user.totp_secret) {
      if (!totpCode) {
        return { error: 'TOTP required', requiresTotp: true };
      }
      if (!this.verifyTotpCode(user.totp_secret, totpCode)) {
        return { error: 'Invalid TOTP code' };
      }
    }

    return this.createSession(user);
  }

  validateSession(token: string): SessionInfo | null {
    this.db.deleteExpiredSessions();
    const session = this.db.getSession(token);
    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      this.db.deleteSession(token);
      return null;
    }

    return {
      token: session.token,
      userId: session.user_id,
      username: session.username,
      role: session.role,
      expiresAt: session.expires_at,
    };
  }

  // ─── TOTP ─────────────────────────────────────────────────────────────────

  setupTotp(userId: string): { secret: string; otpauthUri: string } {
    const secret = randomBytes(20).toString('hex');
    const user = this.db.getUser(userId);
    if (!user) throw new Error('User not found');

    // Store secret but don't enable yet
    this.db.updateUserTotp(userId, secret, false);

    const otpauthUri = `otpauth://totp/NexusCore:${user.username}?secret=${this.hexToBase32(secret)}&issuer=NexusCore&algorithm=SHA1&digits=6&period=30`;
    return { secret: this.hexToBase32(secret), otpauthUri };
  }

  enableTotp(userId: string, code: string): boolean {
    const user = this.db.getUser(userId);
    if (!user || !user.totp_secret) return false;

    if (this.verifyTotpCode(user.totp_secret, code)) {
      this.db.updateUserTotp(userId, user.totp_secret, true);
      return true;
    }
    return false;
  }

  isTotpEnabled(userId: string): boolean {
    const user = this.db.getUser(userId);
    return user ? user.totp_enabled === 1 : false;
  }

  // ─── Self-Service ────────────────────────────────────────────────────────

  changePassword(userId: string, oldPassword: string, newPassword: string): { success: boolean; error?: string } {
    const user = this.db.getUser(userId);
    if (!user) return { success: false, error: 'User not found' };

    if (!this.verifyPassword(oldPassword, user.password_hash, user.salt)) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const salt = randomBytes(16).toString('hex');
    const hash = this.hashPassword(newPassword, salt);
    this.db.updateUserPassword(userId, hash, salt);
    return { success: true };
  }

  disableTotp(userId: string, password: string): { success: boolean; error?: string } {
    const user = this.db.getUser(userId);
    if (!user) return { success: false, error: 'User not found' };

    if (!this.verifyPassword(password, user.password_hash, user.salt)) {
      return { success: false, error: 'Password is incorrect' };
    }

    this.db.updateUserTotp(userId, null, false);
    return { success: true };
  }

  // ─── Default Admin ────────────────────────────────────────────────────────

  ensureDefaultAdmin(): boolean {
    const users = this.db.listUsers();
    if (users.length > 0) return false;

    this.createUser('admin', 'admin', 'admin');
    console.log('[Maestro] Default admin user created (username: admin, password: admin)');
    console.log('[Maestro] ⚠ Change the default password immediately!');
    return true;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private createSession(user: UserRow): SessionInfo {
    const token = `nxm_${randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    this.db.insertSession(token, user.id, expiresAt);

    return {
      token,
      userId: user.id,
      username: user.username,
      role: user.role,
      expiresAt,
    };
  }

  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  }

  private verifyPassword(password: string, hash: string, salt: string): boolean {
    const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, 'hex');
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  }

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
    // HMAC-based TOTP (RFC 6238) using node:crypto
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
