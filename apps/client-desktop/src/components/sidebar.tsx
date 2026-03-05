import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderTree, GitBranch } from 'lucide-react';
import { FileExplorer } from './file-explorer/file-explorer.js';
import { GitPanel } from './git/git-panel.js';

export function Sidebar() {
  const [showFiles, setShowFiles] = useState(true);
  const [showGit, setShowGit] = useState(true);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] text-xs">
      {/* File Explorer Section */}
      <div className="flex flex-col min-h-0" style={{ flex: showGit ? '1 1 60%' : '1 1 100%' }}>
        <button
          onClick={() => setShowFiles(!showFiles)}
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-[var(--bg-hover)] uppercase tracking-wider font-semibold text-[11px] text-[var(--text-secondary)] shrink-0"
        >
          {showFiles ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <FolderTree size={12} />
          Explorer
        </button>
        {showFiles && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <FileExplorer />
          </div>
        )}
      </div>

      {/* Git Section */}
      <div className="flex flex-col min-h-0 border-t border-[var(--border-color)]" style={{ flex: showFiles ? '0 1 40%' : '1 1 100%' }}>
        <button
          onClick={() => setShowGit(!showGit)}
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-[var(--bg-hover)] uppercase tracking-wider font-semibold text-[11px] text-[var(--text-secondary)] shrink-0"
        >
          {showGit ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <GitBranch size={12} />
          Source Control
        </button>
        {showGit && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <GitPanel />
          </div>
        )}
      </div>
    </div>
  );
}
