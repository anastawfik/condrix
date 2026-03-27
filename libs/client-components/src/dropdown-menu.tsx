import type { ReactNode, ComponentPropsWithoutRef } from 'react';
import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';
import { cn } from './lib/utils.js';

/* ─── Legacy prop-based API (kept for backward compat) ───────────────────── */

export interface DropdownMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenu({ trigger, items, align = 'start', className }: DropdownMenuProps) {
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild className={className}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {items.map((item, i) => (
          <DropdownMenuItemComponent
            key={i}
            disabled={item.disabled}
            onClick={item.onClick}
            className={item.danger ? 'text-[var(--accent-red)]' : undefined}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItemComponent>
        ))}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}

/* ─── Compound component API ─────────────────────────────────────────────── */

export const DropdownMenuRoot = RadixDropdownMenu.Root;

export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = 'start',
  ...props
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-[160px] py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md shadow-xl data-[state=open]:animate-dropdown-in data-[state=closed]:animate-dropdown-out',
          className,
        )}
        {...props}
      />
    </RadixDropdownMenu.Portal>
  );
}
DropdownMenuContent.displayName = 'DropdownMenuContent';

export function DropdownMenuItemComponent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item>) {
  return (
    <RadixDropdownMenu.Item
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] cursor-default select-none outline-none transition-colors hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
        className,
      )}
      {...props}
    />
  );
}
DropdownMenuItemComponent.displayName = 'DropdownMenuItem';

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>) {
  return (
    <RadixDropdownMenu.Separator
      className={cn('h-px my-1 bg-[var(--border-color)]', className)}
      {...props}
    />
  );
}
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';
