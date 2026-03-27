import { Collapsible } from 'radix-ui';
import { ChevronRight } from 'lucide-react';
import { cn } from './lib/utils.js';

export interface CollapsibleSectionProps {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  open,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible.Root open={open} onOpenChange={onToggle}>
      <Collapsible.Trigger className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors">
        <ChevronRight
          size={12}
          className={cn(
            'shrink-0 text-[var(--text-muted)] transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          {title}
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="px-4 pb-4">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
