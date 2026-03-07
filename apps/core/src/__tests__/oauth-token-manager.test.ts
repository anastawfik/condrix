import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createTestDatabase } from './helpers.js';
import type { CoreDatabase } from '../database.js';
import { OAuthTokenManager } from '../services/oauth-token-manager.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

describe('OAuthTokenManager', () => {
  let db: CoreDatabase;
  let manager: OAuthTokenManager;

  beforeEach(() => {
    db = createTestDatabase();
    manager = new OAuthTokenManager(db);
  });

  afterEach(() => {
    manager.destroy();
    db.close();
  });

  describe('setTokens', () => {
    it('should store tokens in the database', () => {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      manager.setTokens('access-123', 'refresh-456', expiresAt);

      expect(db.getSetting('oauth.accessToken')).toBe('access-123');
      expect(db.getSetting('oauth.refreshToken')).toBe('refresh-456');
      expect(db.getSetting('oauth.expiresAt')).toBe(expiresAt);
    });
  });

  describe('getAccessToken', () => {
    it('should return null when no token is stored', async () => {
      const token = await manager.getAccessToken();
      expect(token).toBeNull();
    });

    it('should return the stored token when valid', async () => {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      manager.setTokens('access-valid', 'refresh-456', expiresAt);

      const token = await manager.getAccessToken();
      expect(token).toBe('access-valid');
    });

    it('should return null when token is expired and refresh fails', async () => {
      const expiresAt = new Date(Date.now() - 1000).toISOString(); // expired
      manager.setTokens('access-expired', 'refresh-456', expiresAt);

      // Mock fetch to fail
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const token = await manager.getAccessToken();
      expect(token).toBeNull();

      vi.unstubAllGlobals();
    });
  });

  describe('getStatus', () => {
    it('should return method "none" when nothing configured', () => {
      const status = manager.getStatus();
      expect(status.authenticated).toBe(false);
      expect(status.method).toBe('none');
    });

    it('should return method "apikey" when API key is set', () => {
      db.setSetting('model.apiKey', 'sk-ant-test');
      const status = manager.getStatus();
      expect(status.authenticated).toBe(true);
      expect(status.method).toBe('apikey');
    });

    it('should return method "oauth" when OAuth tokens are set', () => {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      db.setSetting('auth.method', 'oauth');
      manager.setTokens('access-token', 'refresh-token', expiresAt);

      const status = manager.getStatus();
      expect(status.authenticated).toBe(true);
      expect(status.method).toBe('oauth');
      expect(status.expiresAt).toBe(expiresAt);
    });
  });

  describe('refreshAccessToken', () => {
    it('should throw when no refresh token exists', async () => {
      await expect(manager.refreshAccessToken()).rejects.toThrow('No refresh token available');
    });

    it('should call Anthropic OAuth endpoint and store new tokens', async () => {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      manager.setTokens('old-access', 'old-refresh', expiresAt);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 28800, // 8 hours
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const newToken = await manager.refreshAccessToken();
      expect(newToken).toBe('new-access-token');
      expect(db.getSetting('oauth.accessToken')).toBe('new-access-token');
      expect(db.getSetting('oauth.refreshToken')).toBe('new-refresh-token');

      // Verify fetch was called with correct parameters
      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://console.anthropic.com/api/oauth/token');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.grant_type).toBe('refresh_token');
      expect(body.refresh_token).toBe('old-refresh');
      expect(body.client_id).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e');

      vi.unstubAllGlobals();
    });

    it('should call onTokenRefreshed callback after refresh', async () => {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      manager.setTokens('old-access', 'old-refresh', expiresAt);

      const callback = vi.fn();
      manager.onTokenRefreshed = callback;

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 28800,
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await manager.refreshAccessToken();
      expect(callback).toHaveBeenCalledWith('new-access');

      vi.unstubAllGlobals();
    });

    it('should throw on API error', async () => {
      db.setSetting('oauth.refreshToken', 'some-refresh-token');

      const mockResponse = {
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await expect(manager.refreshAccessToken()).rejects.toThrow('OAuth refresh failed (401)');

      vi.unstubAllGlobals();
    });
  });

  describe('importFromClaudeCode', () => {
    const mockedReadFile = vi.mocked(readFile);

    afterEach(() => {
      mockedReadFile.mockReset();
    });

    it('should return failure when credentials file does not exist', async () => {
      mockedReadFile.mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }),
      );

      const result = await manager.importFromClaudeCode();
      expect(result.success).toBe(false);
      expect(result.message).toContain('credentials file not found');
    });

    it('should return failure when no OAuth tokens in credentials', async () => {
      mockedReadFile.mockResolvedValue(JSON.stringify({ other: 'data' }) as never);

      const result = await manager.importFromClaudeCode();
      expect(result.success).toBe(false);
      expect(result.message).toContain('No OAuth tokens found');
    });

    it('should import tokens from valid credentials file', async () => {
      mockedReadFile.mockResolvedValue(JSON.stringify({
        claudeAiOauth: {
          accessToken: 'sk-ant-oat01-imported',
          refreshToken: 'sk-ant-ort01-imported',
          expiresAt: '2026-12-31T00:00:00.000Z',
        },
      }) as never);

      const result = await manager.importFromClaudeCode();
      expect(result.success).toBe(true);
      expect(db.getSetting('oauth.accessToken')).toBe('sk-ant-oat01-imported');
      expect(db.getSetting('oauth.refreshToken')).toBe('sk-ant-ort01-imported');
      expect(db.getSetting('auth.method')).toBe('oauth');
    });
  });

  describe('destroy', () => {
    it('should clear refresh timer', () => {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      manager.setTokens('access', 'refresh', expiresAt);
      // Should not throw
      manager.destroy();
    });
  });
});
