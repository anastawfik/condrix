/**
 * Settings state management.
 * Loads/saves settings via Core config routes.
 */
import { createStore } from 'zustand/vanilla';

import { multiCoreStore } from './multi-core-store.js';
import { workspaceStore } from './workspace-store.js';

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
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;
      set({ loading: true, error: null });
      try {
        const result = await multiCoreStore.getState().requestOnCore<{ settings: Record<string, unknown> }>(
          coreId, 'core', 'config.list', prefix ? { prefix } : {},
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
      const coreId = workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) throw new Error('No active Core connection');
      try {
        const result = await multiCoreStore.getState().requestOnCore<{ key: string; value: unknown }>(
          coreId, 'core', 'config.set', { key, value },
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
