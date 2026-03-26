import { useStore } from 'zustand';
import { gitStore } from '@condrix/client-shared';

/** Line-level diff coloring for unified diff content shown as a tab. */
export function DiffEditor() {
  const activeDiffPath = useStore(gitStore, (s) => s.activeDiffPath);
  const openDiffs = useStore(gitStore, (s) => s.openDiffs);
  const activeDiff = openDiffs.find((d) => d.path === activeDiffPath);

  if (!activeDiff) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--bg-primary)] text-[var(--text-muted)] text-sm">
        Select a file from Source Control to view its diff
      </div>
    );
  }

  const lines = activeDiff.diff.split('\n');

  return (
    <div className="h-full overflow-auto bg-[var(--bg-primary)] font-mono text-xs leading-5">
      {lines.map((line, i) => {
        let bg = '';
        let color = 'text-[var(--text-secondary)]';

        if (line.startsWith('+++') || line.startsWith('---')) {
          color = 'text-[var(--text-muted)]';
          bg = 'bg-[var(--bg-secondary)]';
        } else if (line.startsWith('@@')) {
          color = 'text-[var(--accent-blue)]';
          bg = 'bg-[rgba(59,130,246,0.08)]';
        } else if (line.startsWith('+')) {
          color = 'text-[var(--accent-green)]';
          bg = 'bg-[rgba(34,197,94,0.1)]';
        } else if (line.startsWith('-')) {
          color = 'text-[var(--accent-red)]';
          bg = 'bg-[rgba(239,68,68,0.1)]';
        } else if (line.startsWith('diff ')) {
          color = 'text-[var(--text-primary)] font-semibold';
          bg = 'bg-[var(--bg-tertiary)]';
        }

        return (
          <div key={i} className={`px-4 whitespace-pre ${bg} ${color}`}>
            {line || '\u00A0'}
          </div>
        );
      })}
    </div>
  );
}
