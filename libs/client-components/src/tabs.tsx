import type { ReactNode, ComponentPropsWithoutRef } from 'react';
import { Tabs as RadixTabs } from 'radix-ui';
import { cn } from './lib/utils.js';

/* ─── Radix-based compound API ───────────────────────────────────────────── */

export interface TabsProps {
  defaultTab: string;
  children: ReactNode;
  className?: string;
  onChange?: (tabId: string) => void;
}

export function Tabs({ defaultTab, children, className, onChange }: TabsProps) {
  return (
    <RadixTabs.Root
      defaultValue={defaultTab}
      onValueChange={onChange}
      className={className}
    >
      {children}
    </RadixTabs.Root>
  );
}

export interface TabListProps extends ComponentPropsWithoutRef<typeof RadixTabs.List> {}

export function TabList({ className, ...props }: TabListProps) {
  return (
    <RadixTabs.List
      className={cn('flex border-b border-[var(--border-color)]', className)}
      {...props}
    />
  );
}

export interface TabProps extends Omit<ComponentPropsWithoutRef<typeof RadixTabs.Trigger>, 'value'> {
  id: string;
  icon?: ReactNode;
}

export function Tab({ id, icon, className, children, ...props }: TabProps) {
  return (
    <RadixTabs.Trigger
      value={id}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
        'data-[state=active]:border-[var(--accent-blue)] data-[state=active]:text-[var(--text-primary)]',
        'data-[state=inactive]:border-transparent data-[state=inactive]:text-[var(--text-secondary)] data-[state=inactive]:hover:text-[var(--text-primary)] data-[state=inactive]:hover:bg-[var(--bg-hover)]',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </RadixTabs.Trigger>
  );
}

export interface TabPanelProps extends Omit<ComponentPropsWithoutRef<typeof RadixTabs.Content>, 'value'> {
  id: string;
}

export function TabPanel({ id, className, ...props }: TabPanelProps) {
  return (
    <RadixTabs.Content
      value={id}
      className={cn('outline-none', className)}
      {...props}
    />
  );
}
