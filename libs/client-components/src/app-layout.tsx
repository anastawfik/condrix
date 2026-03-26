import { useEffect } from 'react';
import { useStore } from 'zustand';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Layers } from 'lucide-react';
import { workspaceStore, multiCoreStore } from '@condrix/client-shared';
import { CoreTreeSidebar } from './core-tree-sidebar.js';
import { EmptyState } from './empty-state.js';

export interface AppLayoutProps {
  /** Render the center panel (editor/chat). Receives current workspaceId. */
  renderCenter?: (workspaceId: string) => React.ReactNode;
  /** Render the right panel (git changes + terminals). Receives current workspaceId. */
  renderRight?: (workspaceId: string) => React.ReactNode;
  /** Render the title bar. */
  renderTitleBar?: () => React.ReactNode;
}

export function AppLayout({ renderCenter, renderRight, renderTitleBar }: AppLayoutProps) {
  const currentWorkspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);

  // Auto-connect on mount
  useEffect(() => {
    multiCoreStore.getState().autoConnectAll();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {renderTitleBar?.()}

      <Group orientation="horizontal" className="flex-1 min-h-0">
        {/* Left: Core tree sidebar */}
        <Panel defaultSize="20%" minSize="200px" maxSize="400px" className="min-w-0">
          <CoreTreeSidebar />
        </Panel>

        <Separator className="w-[1px] bg-[var(--border-color)] hover:bg-[var(--accent-blue)] transition-colors" />

        {/* Center + Right */}
        {currentWorkspaceId ? (
          <Panel defaultSize="80%" minSize="40%" className="min-w-0">
            <Group orientation="horizontal" className="h-full">
              {/* Center: Editor/Chat */}
              <Panel defaultSize="60%" minSize="30%" className="min-w-0">
                {renderCenter ? renderCenter(currentWorkspaceId) : (
                  <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
                    <EmptyState
                      icon={<Layers size={40} />}
                      title="Workspace active"
                      description="Chat and editor go here"
                    />
                  </div>
                )}
              </Panel>

              <Separator className="w-[1px] bg-[var(--border-color)] hover:bg-[var(--accent-blue)] transition-colors" />

              {/* Right: Git + Terminals */}
              <Panel defaultSize="40%" minSize="200px" collapsible className="min-w-0">
                {renderRight ? renderRight(currentWorkspaceId) : (
                  <div className="flex items-center justify-center h-full bg-[var(--bg-primary)] text-[var(--text-muted)] text-xs">
                    Git changes & terminals
                  </div>
                )}
              </Panel>
            </Group>
          </Panel>
        ) : (
          <Panel defaultSize="80%" minSize="40%" className="min-w-0">
            <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
              <EmptyState
                icon={<Layers size={40} />}
                title="Select a workspace"
                description="Connect to a Core and select a workspace from the sidebar"
              />
            </div>
          </Panel>
        )}
      </Group>
    </div>
  );
}
