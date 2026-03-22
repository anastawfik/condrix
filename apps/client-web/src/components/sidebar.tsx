import { Files, FolderGit2 } from 'lucide-react';
import { ScrollArea } from '@nexus-core/client-components';
import { FileExplorer } from './file-explorer/file-explorer.js';
import { GitPanel } from './git/git-panel.js';

export function Sidebar() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-secondary)]" data-testid="sidebar">
      {/* Explorer section — takes remaining space */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 px-3 h-9 shrink-0 border-b border-[var(--border-color)] uppercase tracking-wide font-semibold text-[11px] text-[var(--text-secondary)]">
          <Files size={14} className="text-[var(--text-muted)]" />
          Explorer
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <FileExplorer />
        </ScrollArea>
      </div>

      {/* Source Control section — fixed bottom portion */}
      <div className="flex flex-col min-h-[180px] max-h-[40%]">
        <div className="flex items-center gap-2 px-3 h-9 shrink-0 border-t border-b border-[var(--border-color)] uppercase tracking-wide font-semibold text-[11px] text-[var(--text-secondary)]">
          <FolderGit2 size={14} className="text-[var(--text-muted)]" />
          Source Control
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <GitPanel />
        </ScrollArea>
      </div>
    </div>
  );
}
