import { useStore } from 'zustand';
import { Settings } from 'lucide-react';
import { multiCoreStore, workspaceStore, maestroStore } from '@condrix/client-shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export interface TitleBarProps {
  onSettingsOpen?: () => void;
  maestroConnected?: boolean;
}

export function TitleBar({ onSettingsOpen, maestroConnected }: TitleBarProps) {
  const connections = useStore(multiCoreStore, (s) => s.connections);
  const maestroCores = useStore(maestroStore, (s) => s.maestroCores);
  const currentWorkspace = useStore(workspaceStore, (s) => s.currentWorkspace);
  const currentProjectId = useStore(workspaceStore, (s) => s.currentProjectId);
  const projects = useStore(workspaceStore, (s) => s.projects);

  let connectedCount: number;
  let totalCount: number;
  if (maestroConnected) {
    totalCount = maestroCores.length;
    connectedCount = maestroCores.filter((c) => c.status === 'online').length;
  } else {
    totalCount = connections.size;
    connectedCount = Array.from(connections.values()).filter(
      (c) => c.connState === 'connected',
    ).length;
  }

  const statusColor = connectedCount > 0
    ? connectedCount === totalCount ? 'bg-green-500' : 'bg-yellow-500'
    : totalCount > 0 ? 'bg-red-500' : 'bg-muted-foreground';

  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null;

  return (
    <div className="flex items-center h-10 px-4 bg-card border-b border-border select-none shrink-0" data-testid="title-bar">
      <span className="font-semibold text-primary mr-4">Condrix</span>

      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {maestroConnected && (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-primary" title="Maestro connected" />
            <span className="text-primary font-medium">Maestro</span>
            <span className="text-muted-foreground/40">|</span>
          </>
        )}
        <span className={cn('w-2.5 h-2.5 rounded-full', statusColor)} />
        <span>
          {totalCount > 0
            ? `${connectedCount}/${totalCount} Core${totalCount > 1 ? 's' : ''}`
            : 'No Cores'}
        </span>
      </div>

      {currentWorkspace && currentProject && (
        <>
          <span className="mx-3 text-muted-foreground/40">|</span>
          <span className="text-sm text-foreground">
            {currentProject.name} / {currentWorkspace.name}
          </span>
        </>
      )}

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onSettingsOpen} aria-label="Settings">
            <Settings className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
    </div>
  );
}
