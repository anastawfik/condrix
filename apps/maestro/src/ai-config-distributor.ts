/**
 * Manages Claude AI auth at the Maestro level and pushes config to connected Cores.
 */
import { generateMessageId } from '@condrix/protocol';
import type { MaestroDatabase } from './database.js';
import type { CoreConnectionManager } from './core-connection-manager.js';

interface AiConfig {
  method?: string;
  apiKey?: string;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
}

const AI_CONFIG_KEYS = ['method', 'apiKey', 'oauthAccessToken', 'oauthRefreshToken'] as const;

export class AiConfigDistributor {
  private coreManager: CoreConnectionManager | null = null;

  constructor(private db: MaestroDatabase) {}

  setCoreManager(coreManager: CoreConnectionManager): void {
    this.coreManager = coreManager;
  }

  getConfig(): AiConfig {
    const raw = this.db.getAllAiConfig();
    const config: AiConfig = {};
    for (const key of AI_CONFIG_KEYS) {
      const value = raw[key];
      if (value !== undefined) {
        (config as Record<string, unknown>)[key] = value;
      }
    }
    return config;
  }

  setConfig(updates: Record<string, unknown>): number {
    for (const key of AI_CONFIG_KEYS) {
      if (key in updates && updates[key] !== undefined) {
        this.db.setAiConfig(key, String(updates[key]));
      }
    }
    return this.pushToAllCores();
  }

  /**
   * Push current AI config to a single Core (called when a Core first connects).
   */
  pushToCore(coreDbId: string): void {
    if (!this.coreManager) return;
    const config = this.getConfig();
    if (!config.method) return; // No AI config set yet

    this.pushConfigToCore(coreDbId, config);
  }

  /**
   * Push current AI config to all connected Cores.
   */
  pushToAllCores(): number {
    if (!this.coreManager) return 0;
    const config = this.getConfig();
    if (!config.method) return 0;

    const coreIds = this.coreManager.getConnectedCoreIds();
    let pushed = 0;
    for (const coreId of coreIds) {
      if (this.pushConfigToCore(coreId, config)) {
        pushed++;
      }
    }
    return pushed;
  }

  private pushConfigToCore(coreDbId: string, config: AiConfig): boolean {
    if (!this.coreManager) return false;

    // Push auth method
    if (config.method) {
      this.sendConfigSet(coreDbId, 'auth.method', config.method);
    }

    // Push API key
    if (config.apiKey) {
      this.sendConfigSet(coreDbId, 'model.apiKey', config.apiKey);
    }

    // Push OAuth access token only — Maestro owns refresh lifecycle.
    // Sending the refresh token to Cores causes token rotation conflicts
    // where both services independently refresh, invalidating each other's tokens.
    if (config.oauthAccessToken) {
      this.sendConfigSet(coreDbId, 'oauth.accessToken', config.oauthAccessToken);
    }

    return true;
  }

  private sendConfigSet(coreDbId: string, key: string, value: unknown): void {
    if (!this.coreManager) return;

    const msg = {
      id: generateMessageId(),
      type: 'request' as const,
      namespace: 'core',
      action: 'config.set',
      payload: { key, value },
      timestamp: new Date().toISOString(),
    };

    this.coreManager.sendToCore(coreDbId, msg);
  }
}
