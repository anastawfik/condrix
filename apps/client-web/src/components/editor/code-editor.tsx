import { useCallback, useRef, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useStore } from 'zustand';
import { workspaceStore, useFileContent } from '@condrix/client-shared';

export function CodeEditor() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const { activeFile, saveFile, updateContent } = useFileContent(workspaceId);

  const handleChange = useCallback((value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateContent(activeFile.path, value);
    }
  }, [activeFile, updateContent]);

  const handleSave = useCallback(() => {
    if (activeFile && activeFile.dirty) {
      saveFile(activeFile.path, activeFile.content);
    }
  }, [activeFile, saveFile]);

  // Ref to avoid stale closure in Monaco command
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // Global Ctrl+S handler — catches saves when focus is outside Monaco
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--bg-primary)] text-[var(--text-muted)] text-sm">
        Open a file from the explorer to edit
      </div>
    );
  }

  return (
    <MonacoEditor
      theme="vs-dark"
      language={activeFile.language}
      value={activeFile.content}
      onChange={handleChange}
      onMount={(editor) => {
        editor.addCommand(2097, () => handleSaveRef.current());
      }}
      options={{
        fontSize: 13,
        fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        automaticLayout: true,
        padding: { top: 8 },
      }}
    />
  );
}
