/**
 * Settings state management.
 * Loads/saves settings via Core config routes.
 */
import { createStore } from 'zustand/vanilla';

import { connectionStore } from './connection-store.js';

export interface SettingsStore {
  settings: Record<string, unknown>;
  loading: boolean;
  error: string | null;

  loadSettings: (prefix?: string) => Promise<void>;
  getSetting: <T = unknown>(key: string) => T | undefined;
  setSetting: (key: string, value: unknown) => Promise<void>;
}

export const createSettingsStore = () =>
  createStore<SettingsStore>((set, get) => ({
    settings: {},
    loading: false,
    error: null,

    loadSettings: async (prefix?: string) => {
      set({ loading: true, error: null });
      try {
        const result = await connectionStore.getState().request<{ settings: Record<string, unknown> }>(
          'core',
          'config.list',
          prefix ? { prefix } : {},
        );
        set((state) => ({
          settings: { ...state.settings, ...result.settings },
          loading: false,
        }));
      } catch (err) {
        set({ loading: false, error: (err as Error).message });
      }
    },

    getSetting: <T = unknown>(key: string): T | undefined => {
      return get().settings[key] as T | undefined;
    },

    setSetting: async (key: string, value: unknown) => {
      try {
        const result = await connectionStore.getState().request<{ key: string; value: unknown }>(
          'core',
          'config.set',
          { key, value },
        );
        set((state) => ({
          settings: { ...state.settings, [result.key]: result.value },
          error: null,
        }));
      } catch (err) {
        set({ error: (err as Error).message });
        throw err;
      }
    },
  }));

/** Default singleton store instance */
export const settingsStore = createSettingsStore();
