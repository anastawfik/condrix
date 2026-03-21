import { useState, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import { RefreshCw, GitBranch, Check } from 'lucide-react';
import { workspaceStore, useGitStatus } from '@nexus-core/client-shared';
import { Tooltip, TooltipProvider, IconButton } from '@nexus-core/client-components';
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
      <p className="px-3 py-6 text-sm text-[var(--text-muted)] text-center">No workspace selected</p>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full" data-testid="git-panel">
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--border-color)]">
          <GitBranch size={14} className="text-[var(--accent-green)]" />
          <span className="text-sm text-[var(--text-secondary)] truncate">{branch || '...'}</span>
          <div className="flex-1" />
          <Tooltip content="Refresh git status">
            <IconButton
              icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={refresh}
              disabled={loading}
              size="sm"
            />
          </Tooltip>
        </div>

        <div className="p-2.5 border-b border-[var(--border-color)]">
          <div className="flex gap-1.5">
            <input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Commit message"
              aria-label="Commit message"
              data-testid="commit-message-input"
              className="flex-1 px-2.5 py-1.5 text-sm bg-[var(--bg-input)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:ring-1 focus:ring-[var(--accent-blue)]"
            />
            <Tooltip content="Commit (Ctrl+Enter)">
              <button
                onClick={handleCommit}
                disabled={!commitMsg.trim() || staged.length === 0}
                aria-label="Commit changes"
                data-testid="commit-button"
                className="p-1.5 rounded-md bg-[var(--accent-blue)] text-white disabled:opacity-30 disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] transition-colors"
              >
                <Check size={16} />
              </button>
            </Tooltip>
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
            <p className="px-3 py-6 text-sm text-[var(--text-muted)] text-center">No changes</p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
