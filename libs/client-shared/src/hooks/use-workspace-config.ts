/**
 * Hook for reading/writing workspace-level configuration.
 * Caches locally and persists to the Core via workspace:config routes.
 */
import { useState, useEffect, useCallback } from 'react';
import type { PermissionMode } from '@condrix/protocol';
import { multiCoreStore } from '../stores/multi-core-store.js';
import { workspaceStore } from '../stores/workspace-store.js';

export interface WorkspaceConfig {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  permissionMode?: PermissionMode;
}

export interface UseWorkspaceConfigReturn {
  config: WorkspaceConfig;
  loading: boolean;
  setConfig: (key: keyof WorkspaceConfig, value: string | number | undefined) => Promise<void>;
}

export function useWorkspaceConfig(workspaceId: string | null): UseWorkspaceConfigReturn {
  const [config, setConfigState] = useState<WorkspaceConfig>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setConfigState({});
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const coreId =
          workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
        if (!coreId) return;
        const result = await multiCoreStore
          .getState()
          .requestOnCore<WorkspaceConfig>(coreId, 'workspace', 'config.get', { workspaceId });
        if (!cancelled) setConfigState(result);
      } catch {
        // Core may not support workspace config yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Listen for agent-initiated permission mode changes
  useEffect(() => {
    if (!workspaceId) return;
    const coreId =
      workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
    if (!coreId) return;

    const unsub = multiCoreStore
      .getState()
      .subscribeOnCore(coreId, 'agent:modeChanged', (event) => {
        const payload = event.payload as { workspaceId: string; permissionMode: string };
        if (payload.workspaceId === workspaceId && payload.permissionMode) {
          setConfigState((prev) => ({
            ...prev,
            permissionMode: payload.permissionMode as PermissionMode,
          }));
        }
      });

    return unsub;
  }, [workspaceId]);

  const setConfig = useCallback(
    async (key: keyof WorkspaceConfig, value: string | number | undefined) => {
      if (!workspaceId) return;
      const coreId =
        workspaceStore.getState().currentCoreId ?? multiCoreStore.getState().activeCoreId;
      if (!coreId) return;

      // Optimistic update
      setConfigState((prev) => ({ ...prev, [key]: value }));

      try {
        await multiCoreStore
          .getState()
          .requestOnCore(coreId, 'workspace', 'config.set', {
            workspaceId,
            key,
            value: value !== undefined ? String(value) : '',
          });
      } catch {
        // Revert on failure — reload
        try {
          const result = await multiCoreStore
            .getState()
            .requestOnCore<WorkspaceConfig>(coreId, 'workspace', 'config.get', { workspaceId });
          setConfigState(result);
        } catch {
          /* ignore */
        }
      }
    },
    [workspaceId],
  );

  return { config, loading, setConfig };
}
