import { useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { AppLayout, TitleBar, TooltipProvider } from '@nexus-core/client-components';
import { Sidebar } from './components/sidebar.js';
import { EditorTabs } from './components/editor/editor-tabs.js';
import { TerminalPanel } from './components/terminal/terminal-panel.js';
import { SettingsDialog } from './components/settings/settings-dialog.js';

function DesktopTitleBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <TitleBar onSettingsOpen={() => setSettingsOpen(true)} />
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
      <Separator className="h-[1px] bg-[var(--border-color)] hover:bg-[var(--accent-blue)] transition-colors" />
      <Panel defaultSize="50%" minSize="80px" collapsible className="min-h-0">
        <TerminalPanel />
      </Panel>
    </Group>
  );
}

export function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <AppLayout
        renderTitleBar={() => <DesktopTitleBar />}
        renderCenter={(wsId) => CenterPanel(wsId)}
        renderRight={(wsId) => RightPanel(wsId)}
      />
    </TooltipProvider>
  );
}
