import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FileExplorer } from './file-explorer/file-explorer.js';
import { GitPanel } from './git/git-panel.js';

export function Sidebar() {
  const [showFiles, setShowFiles] = useState(true);
  const [showGit, setShowGit] = useState(true);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-secondary text-sm">
      {/* Explorer section */}
      <div className="flex flex-col min-h-0" style={{ flex: showGit ? '1 1 60%' : '1 1 100%' }}>
        <button
          onClick={() => setShowFiles(!showFiles)}
          className="flex items-center gap-1 px-2 h-9 shrink-0 bg-secondary hover:bg-accent border-b border-border uppercase tracking-wider font-semibold text-[11px] text-muted-foreground"
        >
          {showFiles ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Explorer
        </button>
        {showFiles && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <FileExplorer />
          </div>
        )}
      </div>

      {/* Source Control section */}
      <div className="flex flex-col min-h-0" style={{ flex: showFiles ? '0 1 40%' : '1 1 100%' }}>
        <button
          onClick={() => setShowGit(!showGit)}
          className="flex items-center gap-1 px-2 h-9 shrink-0 bg-secondary hover:bg-accent border-t border-b border-border uppercase tracking-wider font-semibold text-[11px] text-muted-foreground"
        >
          {showGit ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
