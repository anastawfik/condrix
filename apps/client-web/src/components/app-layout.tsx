import { useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { TitleBar } from '@nexus-core/client-components';
import { workspaceStore } from '@nexus-core/client-shared';
import { Sidebar } from './sidebar.js';
import { EditorTabs } from './editor/editor-tabs.js';
import { TerminalPanel } from './terminal/terminal-panel.js';
import { SettingsDialog } from './settings/settings-dialog.js';

export function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleBackToProjects = () => {
    workspaceStore.getState().setCurrentWorkspace(null);
    workspaceStore.getState().setCurrentProject(null);
  };

  return (
    <div className="flex flex-col h-screen">
      <TitleBar
        onSettingsOpen={() => setSettingsOpen(true)}
        onBackToProjects={handleBackToProjects}
      />

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

      <Group direction="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={20} minSize={12} collapsible className="min-w-0">
          <Sidebar />
        </Panel>

        <Separator className="w-[1px] bg-border hover:w-[3px] data-[state=hover]:bg-primary data-[state=drag]:bg-primary" />

        <Panel defaultSize={80} minSize={30} className="min-w-0">
          <Group direction="vertical">
            <Panel defaultSize={70} minSize={20} className="min-h-0">
              <EditorTabs />
            </Panel>

            <Separator className="h-[1px] bg-border hover:h-[3px] data-[state=hover]:bg-primary data-[state=drag]:bg-primary" />

            <Panel defaultSize={30} minSize={8} collapsible className="min-h-0">
              <TerminalPanel />
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
