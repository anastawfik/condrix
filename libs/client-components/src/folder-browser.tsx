import { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronRight, Loader2 } from 'lucide-react';
import { multiCoreStore } from '@nexus-core/client-shared';
import type { FileEntry } from '@nexus-core/protocol';
import { Dialog } from './dialog.js';
import { Button } from './button.js';
import { Input } from './input.js';
import { cn } from './lib/utils.js';

export interface FolderBrowserProps {
  coreId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function FolderBrowser({ coreId, open, onClose, onSelect }: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    try {
      const result = await multiCoreStore.getState().requestOnCore<{
        path: string;
        entries: FileEntry[];
      }>(coreId, 'core', 'browse', { path });
      setCurrentPath(result.path);
      setPathInput(result.path);
      setEntries(result.entries);
    } catch {
      // browse failed
    } finally {
      setLoading(false);
    }
  }, [coreId]);

  useEffect(() => {
    if (open) {
      browse();
    }
  }, [open, browse]);

  const handleNavigate = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      browse(entry.path);
    }
  };

  const handleGoUp = () => {
    const parent = currentPath.replace(/\/[^/]+\/?$/, '') || '/';
    browse(parent);
  };

  const handlePathSubmit = () => {
    if (pathInput.trim()) {
      browse(pathInput.trim());
    }
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  // Breadcrumb segments
  const segments = currentPath.split('/').filter(Boolean);

  return (
    <Dialog open={open} onClose={onClose} title="Select Folder" className="w-[520px] max-h-[80vh]">
      <div className="flex flex-col">
        {/* Path input */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-color)]">
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePathSubmit(); }}
            inputSize="sm"
            className="flex-1"
          />
          <Button size="sm" variant="ghost" onClick={handlePathSubmit}>Go</Button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-0.5 px-4 py-1.5 text-[11px] text-[var(--text-secondary)] overflow-x-auto border-b border-[var(--border-color)]">
          <button
            onClick={() => browse('/')}
            className="hover:text-[var(--text-primary)] shrink-0"
          >
            /
          </button>
          {segments.map((seg, i) => {
            const segPath = '/' + segments.slice(0, i + 1).join('/');
            return (
              <span key={segPath} className="flex items-center gap-0.5 shrink-0">
                <ChevronRight size={10} className="text-[var(--text-muted)]" />
                <button
                  onClick={() => browse(segPath)}
                  className="hover:text-[var(--text-primary)]"
                >
                  {seg}
                </button>
              </span>
            );
          })}
        </div>

        {/* File list */}
        <div className="h-[320px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : (
            <div className="py-1">
              {/* Parent directory */}
              {currentPath !== '/' && (
                <button
                  onClick={handleGoUp}
                  className="flex items-center gap-2 w-full px-4 py-1.5 text-xs hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)]"
                >
                  <Folder size={14} className="text-[var(--accent-blue)]" />
                  ..
                </button>
              )}

              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleNavigate(entry)}
                  disabled={entry.type !== 'directory'}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-1.5 text-xs transition-colors text-left',
                    entry.type === 'directory'
                      ? 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer'
                      : 'text-[var(--text-muted)] cursor-default',
                  )}
                >
                  {entry.type === 'directory' ? (
                    <Folder size={14} className="text-[var(--accent-blue)]" />
                  ) : (
                    <File size={14} />
                  )}
                  <span className="truncate">{entry.name}</span>
                </button>
              ))}

              {entries.length === 0 && !loading && (
                <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                  Empty directory
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
          <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[60%]">
            {currentPath}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSelect}>Select Folder</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
