/**
 * React hook for settings access.
 * Loads settings on mount and provides get/set helpers.
 */
import { useEffect } from 'react';
import { useStore } from 'zustand';

import { settingsStore, type SettingsStore } from '../stores/settings-store.js';

export interface UseSettingsReturn {
  settings: Record<string, unknown>;
  loading: boolean;
  error: string | null;
  getSetting: <T = unknown>(key: string) => T | undefined;
  setSetting: (key: string, value: unknown) => Promise<void>;
  reload: (prefix?: string) => Promise<void>;
}

export function useSettings(prefix?: string): UseSettingsReturn {
  const settings = useStore(settingsStore, (s: SettingsStore) => s.settings);
  const loading = useStore(settingsStore, (s: SettingsStore) => s.loading);
  const error = useStore(settingsStore, (s: SettingsStore) => s.error);

  useEffect(() => {
    settingsStore.getState().loadSettings(prefix).catch(() => { /* ignore */ });
  }, [prefix]);

  return {
    settings,
    loading,
    error,
    getSetting: <T = unknown>(key: string): T | undefined => {
      return settings[key] as T | undefined;
    },
    setSetting: (key: string, value: unknown) => settingsStore.getState().setSetting(key, value),
    reload: (p?: string) => settingsStore.getState().loadSettings(p ?? prefix),
  };
}
