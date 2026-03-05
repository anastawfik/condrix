import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { FileNode } from '@nexus-core/client-shared';
import { FileIcon } from './file-icon.js';

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  onExpand: (path: string) => void;
  onCollapse: (path: string) => void;
  onFileOpen: (path: string) => void;
}

export function TreeNode({ node, depth, onExpand, onCollapse, onFileOpen }: TreeNodeProps) {
  const isDir = node.type === 'directory';
  const paddingLeft = depth * 12 + 4;

  const handleClick = () => {
    if (isDir) {
      if (node.expanded) {
        onCollapse(node.path);
      } else {
        onExpand(node.path);
      }
    } else {
      onFileOpen(node.path);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1 w-full py-[2px] hover:bg-[var(--bg-hover)] text-left text-xs"
        style={{ paddingLeft }}
      >
        {isDir && (
          node.loading ? (
            <Loader2 size={12} className="animate-spin text-[var(--text-muted)] shrink-0" />
          ) : node.expanded ? (
            <ChevronDown size={12} className="text-[var(--text-muted)] shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-[var(--text-muted)] shrink-0" />
          )
        )}
        {!isDir && <span className="w-3 shrink-0" />}
        <FileIcon name={node.name} type={node.type} expanded={node.expanded} />
        <span className="truncate">{node.name}</span>
      </button>

      {isDir && node.expanded && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          onExpand={onExpand}
          onCollapse={onCollapse}
          onFileOpen={onFileOpen}
        />
      ))}
    </>
  );
}
