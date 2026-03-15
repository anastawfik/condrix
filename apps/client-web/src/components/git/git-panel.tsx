import { useState, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import { RefreshCw, GitBranch, Check } from 'lucide-react';
import { workspaceStore, useGitStatus } from '@nexus-core/client-shared';
import { ChangedFileList } from './changed-file-list.js';

export function GitPanel() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const {
    branch, staged, unstaged,
    loading, refresh, stageFiles, unstageFiles, commit,
    openDiffTab,
  } = useGitStatus(workspaceId);

  const [commitMsg, setCommitMsg] = useState('');

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    await commit(commitMsg.trim());
    setCommitMsg('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleCommit();
    }
  };

  if (!workspaceId) {
    return (
      <p className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">No workspace selected</p>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-[var(--border-color)]">
        <GitBranch size={12} className="text-[var(--accent-green)]" />
        <span className="text-xs text-[var(--text-secondary)]">{branch || '...'}</span>
        <div className="flex-1" />
        <button
          onClick={refresh}
          disabled={loading}
          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
          aria-label="Refresh git status"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-2 border-b border-[var(--border-color)]">
        <div className="flex gap-1">
          <input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Commit message"
            className="flex-1 px-2 py-1 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
          />
          <button
            onClick={handleCommit}
            disabled={!commitMsg.trim() || staged.length === 0}
            className="p-1 rounded bg-[var(--accent-blue)] text-white disabled:opacity-50"
            title="Commit (Ctrl+Enter)"
            aria-label="Commit changes"
          >
            <Check size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ChangedFileList
          title="Staged Changes"
          files={staged}
          onStageToggle={(path) => unstageFiles([path])}
          onSelect={(path) => openDiffTab(path, true)}
        />
        <ChangedFileList
          title="Changes"
          files={unstaged}
          onStageToggle={(path) => stageFiles([path])}
          onSelect={(path) => openDiffTab(path, false)}
        />

        {staged.length === 0 && unstaged.length === 0 && !loading && (
          <p className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">No changes</p>
        )}
      </div>
    </div>
  );
}
