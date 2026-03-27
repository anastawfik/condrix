import type { ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from './lib/utils.js';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        <RadixDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-2xl data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out focus:outline-none',
            className,
          )}
        >
          {title && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
              <RadixDialog.Title className="text-sm font-semibold text-[var(--text-primary)]">
                {title}
              </RadixDialog.Title>
              <RadixDialog.Close asChild>
                <button
                  className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </RadixDialog.Close>
            </div>
          )}
          {!title && <RadixDialog.Title className="sr-only">Dialog</RadixDialog.Title>}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
