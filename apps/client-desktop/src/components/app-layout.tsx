import { useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { TitleBar } from './title-bar.js';
import { Sidebar } from './sidebar.js';
import { EditorTabs } from './editor/editor-tabs.js';
import { TerminalPanel } from './terminal/terminal-panel.js';
import { SettingsDialog } from './settings/settings-dialog.js';

export function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <TitleBar onSettingsOpen={() => setSettingsOpen(true)} />

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

      <Group direction="horizontal" className="flex-1 min-h-0">
        {/* Sidebar */}
        <Panel defaultSize={20} minSize={12} collapsible className="min-w-0">
          <Sidebar />
        </Panel>

        <Separator className="w-[1px] bg-[var(--border-color)] hover:w-[3px] data-[state=hover]:bg-[var(--accent-blue)] data-[state=drag]:bg-[var(--accent-blue)]" />

        {/* Main content */}
        <Panel defaultSize={80} minSize={30} className="min-w-0">
          <Group direction="vertical">
            {/* Editor / Chat area */}
            <Panel defaultSize={70} minSize={20} className="min-h-0">
              <EditorTabs />
            </Panel>

            <Separator className="h-[1px] bg-[var(--border-color)] hover:h-[3px] data-[state=hover]:bg-[var(--accent-blue)] data-[state=drag]:bg-[var(--accent-blue)]" />

            {/* Terminal */}
            <Panel defaultSize={30} minSize={8} collapsible className="min-h-0">
              <TerminalPanel />
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
