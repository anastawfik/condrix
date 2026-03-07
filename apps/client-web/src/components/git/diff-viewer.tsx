import MonacoEditor from '@monaco-editor/react';

interface DiffViewerProps {
  diff: string;
  path: string | null;
}

export function DiffViewer({ diff, path }: DiffViewerProps) {
  if (!diff) return null;

  return (
    <div className="border-t border-[var(--border-color)]">
      {path && (
        <div className="px-2 py-1 text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
          {path}
        </div>
      )}
      <MonacoEditor
        height="200px"
        theme="vs-dark"
        language="diff"
        value={diff}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: 'off',
          fontSize: 12,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
