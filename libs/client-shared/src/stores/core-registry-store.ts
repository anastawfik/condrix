/**
 * Registry of saved Core connections.
 * Persists to localStorage in browsers, or can be hydrated from any storage backend.
 */
import { createStore } from 'zustand/vanilla';

export interface CoreEntry {
  id: string;
  name: string;
  url: string;
  token?: string;
  lastConnected?: string;
  autoConnect?: boolean;
}

export interface CoreRegistryStore {
  cores: CoreEntry[];
  addCore: (entry: Omit<CoreEntry, 'id'>) => CoreEntry;
  updateCore: (id: string, updates: Partial<Omit<CoreEntry, 'id'>>) => void;
  removeCore: (id: string) => void;
  getCore: (id: string) => CoreEntry | undefined;
  _persist: () => void;
  _hydrate: () => void;
}

const STORAGE_KEY = 'condrix-registry';

let idCounter = 0;
function nextId(): string {
  return `core_${Date.now()}_${++idCounter}`;
}

export const createCoreRegistryStore = () =>
  createStore<CoreRegistryStore>((set, get) => ({
    cores: [],

    addCore: (entry) => {
      const core: CoreEntry = { ...entry, id: nextId() };
      set((s) => ({ cores: [...s.cores, core] }));
      get()._persist();
      return core;
    },

    updateCore: (id, updates) => {
      set((s) => ({
        cores: s.cores.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
      get()._persist();
    },

    removeCore: (id) => {
      set((s) => ({ cores: s.cores.filter((c) => c.id !== id) }));
      get()._persist();
    },

    getCore: (id) => get().cores.find((c) => c.id === id),

    _persist: () => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(get().cores));
        }
      } catch {
        /* SSR or storage unavailable */
      }
    },

    _hydrate: () => {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const cores = JSON.parse(raw) as CoreEntry[];
            set({ cores });
          }
        }
      } catch {
        /* SSR or storage unavailable */
      }
    },
  }));

export const coreRegistryStore = createCoreRegistryStore();
// Auto-hydrate on creation
coreRegistryStore.getState()._hydrate();
