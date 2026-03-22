import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { FileNode } from '@nexus-core/client-shared';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { FileIcon } from './file-icon.js';

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  onExpand: (path: string) => void;
  onCollapse: (path: string) => void;
  onFileOpen: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onNewFile?: (dirPath: string) => void;
  onNewFolder?: (dirPath: string) => void;
  onCopyPath?: (path: string) => void;
}

export function TreeNode({ node, depth, onExpand, onCollapse, onFileOpen, onRename, onDelete, onNewFile, onNewFolder, onCopyPath }: TreeNodeProps) {
  const isDir = node.type === 'directory';
  const paddingLeft = depth * 16 + 8;

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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={handleClick}
            className="flex items-center gap-1.5 w-full h-7 hover:bg-accent text-left text-sm"
            style={{ paddingLeft }}
          >
            {isDir && (
              node.loading ? (
                <Loader2 size={16} className="animate-spin text-muted-foreground shrink-0" />
              ) : node.expanded ? (
                <ChevronDown size={16} className="text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              )
            )}
            {!isDir && <span className="w-3 shrink-0" />}
            <FileIcon name={node.name} type={node.type} expanded={node.expanded} />
            <span className="truncate">{node.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {!isDir && (
            <ContextMenuItem onClick={() => onFileOpen(node.path)}>Open</ContextMenuItem>
          )}
          {isDir && (
            <>
              <ContextMenuItem onClick={() => onNewFile?.(node.path)}>New File</ContextMenuItem>
              <ContextMenuItem onClick={() => onNewFolder?.(node.path)}>New Folder</ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => onRename?.(node.path)}>Rename</ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete?.(node.path)} className="text-destructive focus:text-destructive">Delete</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onCopyPath?.(node.path)}>Copy Path</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isDir && node.expanded && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          onExpand={onExpand}
          onCollapse={onCollapse}
          onFileOpen={onFileOpen}
          onRename={onRename}
          onDelete={onDelete}
          onNewFile={onNewFile}
          onNewFolder={onNewFolder}
          onCopyPath={onCopyPath}
        />
      ))}
    </>
  );
}
