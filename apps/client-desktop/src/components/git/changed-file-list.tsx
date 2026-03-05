import { Plus, Minus } from 'lucide-react';
import type { GitFileChange } from '@nexus-core/client-shared';

interface ChangedFileListProps {
  files: GitFileChange[];
  title: string;
  onStageToggle?: (path: string) => void;
  onSelect?: (path: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  M: 'text-[var(--accent-yellow)]',
  A: 'text-[var(--accent-green)]',
  D: 'text-[var(--accent-red)]',
  R: 'text-[var(--accent-blue)]',
  '?': 'text-[var(--accent-green)]',
};

export function ChangedFileList({ files, title, onStageToggle, onSelect }: ChangedFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
        {title} ({files.length})
      </div>
      {files.map((file) => (
        <div
          key={file.path}
          className="flex items-center gap-1 px-2 py-[2px] hover:bg-[var(--bg-hover)] group"
        >
          <span className={`text-xs font-mono w-3 text-center ${STATUS_COLORS[file.status] ?? 'text-[var(--text-secondary)]'}`}>
            {file.status}
          </span>
          <button
            onClick={() => onSelect?.(file.path)}
            className="flex-1 text-xs text-left truncate hover:underline"
          >
            {file.path}
          </button>
          {onStageToggle && (
            <button
              onClick={() => onStageToggle(file.path)}
              className="p-0.5 rounded hover:bg-[var(--bg-active)] opacity-0 group-hover:opacity-100 text-[var(--text-muted)]"
              title={file.staged ? 'Unstage' : 'Stage'}
            >
              {file.staged ? <Minus size={12} /> : <Plus size={12} />}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
