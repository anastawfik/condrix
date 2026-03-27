import { useState, useEffect, useCallback } from 'react';
import { Folder, File, HardDrive, ChevronRight, Loader2 } from 'lucide-react';
import { multiCoreStore } from '@condrix/client-shared';
import type { FileEntry } from '@condrix/protocol';
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

/** Check if a path looks like a Windows drive root (e.g. "C:/"). */
function isDriveRoot(path: string): boolean {
  return /^[A-Za-z]:\/?$/.test(path);
}

/** Check if a path has a Windows drive letter prefix. */
function hasDriveLetter(path: string): boolean {
  return /^[A-Za-z]:/.test(path);
}

/** Is this the drives-list root? (empty path = Windows drive listing) */
function isDrivesRoot(path: string): boolean {
  return path === '';
}

/** Get the parent of a path. Returns '' for drive roots (go back to drives list). */
function parentPath(path: string): string | null {
  // At drives-list root — no parent
  if (isDrivesRoot(path)) return null;
  // At Unix root
  if (path === '/') return null;
  // At Windows drive root — go back to drives list
  if (isDriveRoot(path)) return '';

  const trimmed = path.replace(/\/+$/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  if (lastSlash < 0) return null;

  const parent = trimmed.slice(0, lastSlash) || '/';
  // Don't reduce "C:" to "" — keep "C:/"
  if (hasDriveLetter(parent) && !parent.includes('/')) return parent + '/';
  return parent;
}

/** Split a path into breadcrumb segments. Returns [{ label, path }]. */
function pathSegments(currentPath: string): { label: string; path: string }[] {
  // Drives-list root (Windows)
  if (isDrivesRoot(currentPath)) {
    return [{ label: 'This PC', path: '' }];
  }

  const result: { label: string; path: string }[] = [];

  if (hasDriveLetter(currentPath)) {
    // Windows: "C:/Users/foo" → ["This PC", "C:", "Users", "foo"]
    result.push({ label: 'This PC', path: '' });
    const parts = currentPath.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const segPath = i === 0 ? parts[0] + '/' : parts.slice(0, i + 1).join('/');
      result.push({ label: parts[i], path: segPath });
    }
  } else {
    // Unix: "/home/user" → ["/", "home", "user"]
    result.push({ label: '/', path: '/' });
    const parts = currentPath.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      result.push({ label: parts[i], path: '/' + parts.slice(0, i + 1).join('/') });
    }
  }
  return result;
}

export function FolderBrowser({ coreId, open, onClose, onSelect }: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(
    async (path?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await multiCoreStore.getState().requestOnCore<{
          path: string;
          entries: FileEntry[];
        }>(coreId, 'core', 'browse', path !== undefined ? { path } : {});
        setCurrentPath(result.path);
        setPathInput(result.path);
        setEntries(result.entries);
      } catch (err) {
        setEntries([]);
        setError(err instanceof Error ? err.message : 'Failed to browse directory');
      } finally {
        setLoading(false);
      }
    },
    [coreId],
  );

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
    const parent = parentPath(currentPath);
    if (parent !== null) browse(parent || undefined);
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

  const segments = pathSegments(currentPath);
  const canGoUp = parentPath(currentPath) !== null;
  const atDrivesRoot = isDrivesRoot(currentPath);

  return (
    <Dialog open={open} onClose={onClose} title="Select Folder" className="w-[520px] max-h-[80vh]">
      <div className="flex flex-col">
        {/* Path input */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-color)]">
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePathSubmit();
            }}
            placeholder={atDrivesRoot ? 'Type a path...' : undefined}
            inputSize="sm"
            className="flex-1"
          />
          <Button size="sm" variant="ghost" onClick={handlePathSubmit}>
            Go
          </Button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-0.5 px-4 py-1.5 text-[11px] text-[var(--text-secondary)] overflow-x-auto border-b border-[var(--border-color)]">
          {segments.map((seg, i) => (
            <span key={seg.path || '__root'} className="flex items-center gap-0.5 shrink-0">
              {i > 0 && <ChevronRight size={10} className="text-[var(--text-muted)]" />}
              <button
                onClick={() => browse(seg.path || undefined)}
                className="hover:text-[var(--text-primary)]"
              >
                {seg.label}
              </button>
            </span>
          ))}
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
              {canGoUp && (
                <button
                  onClick={handleGoUp}
                  className="flex items-center gap-2 w-full px-4 py-1.5 text-xs hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)]"
                >
                  <Folder size={14} className="text-[var(--accent-blue)]" />
                  ..
                </button>
              )}

              {entries.map((entry) => {
                const isDrive = isDriveRoot(entry.path);
                return (
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
                    {isDrive ? (
                      <HardDrive size={14} className="text-[var(--accent-blue)]" />
                    ) : entry.type === 'directory' ? (
                      <Folder size={14} className="text-[var(--accent-blue)]" />
                    ) : (
                      <File size={14} />
                    )}
                    <span className="truncate">
                      {isDrive ? `${entry.name} (${entry.path})` : entry.name}
                    </span>
                  </button>
                );
              })}

              {entries.length === 0 && !loading && (
                <div className="text-center py-8 text-xs text-[var(--text-muted)] space-y-2">
                  {error ? (
                    <>
                      <p className="text-[var(--accent-red)]">{error}</p>
                      <button
                        onClick={() => browse(currentPath || undefined)}
                        className="text-[var(--accent-blue)] hover:underline"
                      >
                        Retry
                      </button>
                    </>
                  ) : (
                    <p>{atDrivesRoot ? 'No drives found' : 'Empty directory'}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
          <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[60%]">
            {currentPath || 'Select a drive'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSelect} disabled={atDrivesRoot}>
              Select Folder
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
