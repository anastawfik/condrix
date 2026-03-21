import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderGit2, Files } from 'lucide-react';
import { ScrollArea } from '@nexus-core/client-components';
import { FileExplorer } from './file-explorer/file-explorer.js';
import { GitPanel } from './git/git-panel.js';

export function Sidebar() {
  const [showFiles, setShowFiles] = useState(true);
  const [showGit, setShowGit] = useState(true);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-secondary)] text-sm" data-testid="sidebar">
      {/* Explorer section */}
      <div className="flex flex-col min-h-0" style={{ flex: showGit ? '1 1 60%' : '1 1 100%' }}>
        <button
          onClick={() => setShowFiles(!showFiles)}
          className="flex items-center gap-1.5 px-3 h-8 shrink-0 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border-b border-[var(--border-color)] uppercase tracking-wide font-semibold text-[11px] text-[var(--text-secondary)] transition-colors"
        >
          {showFiles ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Files size={14} className="text-[var(--text-muted)]" />
          Explorer
        </button>
        {showFiles && (
          <ScrollArea className="flex-1 min-h-0">
            <FileExplorer />
          </ScrollArea>
        )}
      </div>

      {/* Source Control section */}
      <div className="flex flex-col min-h-0" style={{ flex: showFiles ? '0 1 40%' : '1 1 100%' }}>
        <button
          onClick={() => setShowGit(!showGit)}
          className="flex items-center gap-1.5 px-3 h-8 shrink-0 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border-t border-b border-[var(--border-color)] uppercase tracking-wide font-semibold text-[11px] text-[var(--text-secondary)] transition-colors"
        >
          {showGit ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FolderGit2 size={14} className="text-[var(--text-muted)]" />
          Source Control
        </button>
        {showGit && (
          <ScrollArea className="flex-1 min-h-0">
            <GitPanel />
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
