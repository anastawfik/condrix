import { useState, useCallback } from 'react';
import { useStore } from 'zustand';
import { Search, RefreshCw } from 'lucide-react';
import { workspaceStore, fileStore, useFileTree, useFileContent } from '@condrix/client-shared';
import { TreeNode } from './tree-node.js';

export function FileExplorer() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const { tree, loading, expandNode, collapseNode, refresh } = useFileTree(workspaceId);
  const { openFile } = useFileContent(workspaceId);
  const [filter, setFilter] = useState('');

  const filteredTree = filter
    ? tree.filter((n) => n.name.toLowerCase().includes(filter.toLowerCase()))
    : tree;

  const handleRename = useCallback(
    (path: string) => {
      if (!workspaceId) return;
      const name = path.split('/').pop() ?? path;
      const newName = prompt('Rename to:', name);
      if (!newName || newName === name) return;
      const parentDir = path.substring(0, path.lastIndexOf('/'));
      const newPath = parentDir ? `${parentDir}/${newName}` : newName;
      fileStore
        .getState()
        .renameFile(workspaceId, path, newPath)
        .catch(() => {});
    },
    [workspaceId],
  );

  const handleDelete = useCallback(
    (path: string) => {
      if (!workspaceId) return;
      const name = path.split('/').pop() ?? path;
      if (!confirm(`Delete "${name}"?`)) return;
      fileStore
        .getState()
        .deleteFile(workspaceId, path)
        .catch(() => {});
    },
    [workspaceId],
  );

  const handleNewFile = useCallback(
    (dirPath: string) => {
      if (!workspaceId) return;
      const name = prompt('New file name:');
      if (!name) return;
      const fullPath = `${dirPath}/${name}`;
      fileStore
        .getState()
        .createFile(workspaceId, fullPath)
        .catch(() => {});
    },
    [workspaceId],
  );

  const handleNewFolder = useCallback(
    (dirPath: string) => {
      if (!workspaceId) return;
      const name = prompt('New folder name:');
      if (!name) return;
      const fullPath = `${dirPath}/${name}`;
      fileStore
        .getState()
        .createDir(workspaceId, fullPath)
        .catch(() => {});
    },
    [workspaceId],
  );

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search size={16} className="text-muted-foreground shrink-0" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          onClick={refresh}
          disabled={loading}
          className="p-0.5 rounded hover:bg-accent text-muted-foreground"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-0.5">
        {!workspaceId && (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
            No workspace selected
          </p>
        )}
        {workspaceId && filteredTree.length === 0 && !loading && (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">No files found</p>
        )}
        {filteredTree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onExpand={expandNode}
            onCollapse={collapseNode}
            onFileOpen={openFile}
            onRename={handleRename}
            onDelete={handleDelete}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            onCopyPath={handleCopyPath}
          />
        ))}
      </div>
    </div>
  );
}
