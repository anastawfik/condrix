import { X } from 'lucide-react';
import type { OpenFile } from '@nexus-core/client-shared';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
} from '@nexus-core/client-components';

interface EditorTabProps {
  file: OpenFile;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers?: () => void;
  onCloseAll?: () => void;
  onCopyPath?: () => void;
}

export function EditorTab({ file, isActive, onSelect, onClose, onCloseOthers, onCloseAll, onCopyPath }: EditorTabProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={onSelect}
          role="tab"
          aria-selected={isActive}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-[var(--border-color)] group cursor-pointer ${
            isActive
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent-blue)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-t-2 border-t-transparent hover:bg-[var(--bg-hover)]'
          }`}
        >
          {file.dirty && <span className="w-2 h-2 rounded-full bg-[var(--text-primary)] shrink-0" />}
          <span className="truncate max-w-[120px]">{file.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label={`Close ${file.name}`}
            className="p-0.5 rounded hover:bg-[var(--bg-active)] opacity-0 group-hover:opacity-100 shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onClose}>Close</ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers}>Close Others</ContextMenuItem>
        <ContextMenuItem onClick={onCloseAll}>Close All</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCopyPath}>Copy Path</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
