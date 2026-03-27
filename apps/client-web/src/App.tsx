import { useState, useEffect, useRef } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { AppLayout, MaestroLoginDialog } from '@condrix/client-components';
import { TitleBar } from './components/title-bar.js';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  maestroStore,
  multiCoreStore,
  workspaceStore,
  fileStore,
  terminalStore,
  getSavedUIState,
} from '@condrix/client-shared';
import type { MaestroConnectionState } from '@condrix/client-shared';
import { Sidebar } from './components/sidebar.js';
import { EditorTabs } from './components/editor/editor-tabs.js';
import { TerminalPanel } from './components/terminal/terminal-panel.js';
import { SettingsDialog } from './components/settings/settings-dialog.js';

function WebTitleBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [maestroState, setMaestroState] = useState<MaestroConnectionState>(
    () => maestroStore.getState().state,
  );

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => setMaestroState(s.state));
    return unsub;
  }, []);

  return (
    <>
      <TitleBar
        onSettingsOpen={() => setSettingsOpen(true)}
        maestroConnected={maestroState === 'connected'}
      />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

function CenterPanel(_workspaceId: string) {
  return <EditorTabs />;
}

function RightPanel(_workspaceId: string) {
  return (
    <Group orientation="vertical" className="h-full">
      <Panel defaultSize="50%" minSize="100px" className="min-h-0">
        <Sidebar />
      </Panel>
      <Separator className="h-[1px] bg-border hover:bg-primary transition-colors" />
      <Panel defaultSize="50%" minSize="80px" collapsible className="min-h-0">
        <TerminalPanel />
      </Panel>
    </Group>
  );
}

export function App() {
  const [showLogin, setShowLogin] = useState(false);
  const restoredRef = useRef(false);

  // Restore UI state from localStorage on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = getSavedUIState();
    if (!saved.activeCoreId || !saved.currentWorkspaceId) return;

    const doRestore = (coreId: string, workspaceId: string, projectId?: string) => {
      multiCoreStore.getState().setActiveCoreId(coreId);

      if (projectId) {
        workspaceStore.getState().setCurrentProject(projectId);
      }

      workspaceStore
        .getState()
        .enterWorkspace(workspaceId, coreId)
        .then(() => fileStore.getState().restoreUIState(workspaceId))
        .then(() => terminalStore.getState().restoreTerminals(workspaceId))
        .catch(() => {
          /* workspace may no longer exist */
        });
    };

    // Check if Core is already connected
    const conn = multiCoreStore.getState().connections.get(saved.activeCoreId);
    if (conn?.connState === 'connected') {
      doRestore(saved.activeCoreId, saved.currentWorkspaceId, saved.currentProjectId);
      return;
    }

    // Wait for the Core to connect
    let cleaned = false;
    const unsub = multiCoreStore.subscribe((state) => {
      if (cleaned) return;
      const c = state.connections.get(saved.activeCoreId!);
      if (c?.connState === 'connected') {
        cleaned = true;
        unsub();
        doRestore(saved.activeCoreId!, saved.currentWorkspaceId!, saved.currentProjectId);
      }
    });

    // Give up after 10s
    const timer = setTimeout(() => {
      cleaned = true;
      unsub();
    }, 10_000);
    return () => {
      cleaned = true;
      unsub();
      clearTimeout(timer);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onContextMenu={(e) => e.preventDefault()} className="contents">
        <AppLayout
          renderTitleBar={() => <WebTitleBar />}
          renderCenter={(wsId) => CenterPanel(wsId)}
          renderRight={(wsId) => RightPanel(wsId)}
        />
        <MaestroLoginDialog
          open={showLogin}
          onClose={() => setShowLogin(false)}
          onDirectConnect={() => setShowLogin(false)}
        />
      </div>
    </TooltipProvider>
  );
}
