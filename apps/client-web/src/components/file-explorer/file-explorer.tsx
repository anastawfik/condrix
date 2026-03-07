import { useState } from 'react';
import { useStore } from 'zustand';
import { Search, RefreshCw } from 'lucide-react';
import { workspaceStore, useFileTree, useFileContent } from '@nexus-core/client-shared';
import { TreeNode } from './tree-node.js';

export function FileExplorer() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const { tree, loading, expandNode, collapseNode, refresh } = useFileTree(workspaceId);
  const { openFile } = useFileContent(workspaceId);
  const [filter, setFilter] = useState('');

  const filteredTree = filter
    ? tree.filter((n) => n.name.toLowerCase().includes(filter.toLowerCase()))
    : tree;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--border-color)]">
        <Search size={12} className="text-[var(--text-muted)] shrink-0" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files..."
          className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        <button
          onClick={refresh}
          disabled={loading}
          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-0.5">
        {!workspaceId && (
          <p className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">No workspace selected</p>
        )}
        {workspaceId && filteredTree.length === 0 && !loading && (
          <p className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">No files found</p>
        )}
        {filteredTree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onExpand={expandNode}
            onCollapse={collapseNode}
            onFileOpen={openFile}
          />
        ))}
      </div>
    </div>
  );
}
