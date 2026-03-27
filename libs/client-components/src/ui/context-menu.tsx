import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { ContextMenu as RadixContextMenu } from 'radix-ui';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '../lib/utils.js';

const ContextMenu = RadixContextMenu.Root;

const ContextMenuTrigger = RadixContextMenu.Trigger;

const ContextMenuGroup = RadixContextMenu.Group;

const ContextMenuPortal = RadixContextMenu.Portal;

const ContextMenuSub = RadixContextMenu.Sub;

const ContextMenuRadioGroup = RadixContextMenu.RadioGroup;

const ContextMenuSubTrigger = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixContextMenu.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <RadixContextMenu.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)] data-[state=open]:bg-[var(--bg-hover)] text-[var(--text-primary)]',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </RadixContextMenu.SubTrigger>
));
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger';

const ContextMenuSubContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixContextMenu.SubContent>
>(({ className, ...props }, ref) => (
  <RadixContextMenu.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1 text-[var(--text-primary)] shadow-xl data-[state=open]:animate-dropdown-in data-[state=closed]:animate-dropdown-out',
      className,
    )}
    {...props}
  />
));
ContextMenuSubContent.displayName = 'ContextMenuSubContent';

const ContextMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixContextMenu.Content>
>(({ className, ...props }, ref) => (
  <RadixContextMenu.Portal>
    <RadixContextMenu.Content
      ref={ref}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1 text-[var(--text-primary)] shadow-xl data-[state=open]:animate-dropdown-in data-[state=closed]:animate-dropdown-out',
        className,
      )}
      {...props}
    />
  </RadixContextMenu.Portal>
));
ContextMenuContent.displayName = 'ContextMenuContent';

const ContextMenuItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixContextMenu.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <RadixContextMenu.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-[var(--text-primary)]',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuCheckboxItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixContextMenu.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <RadixContextMenu.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-[var(--text-primary)]',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <RadixContextMenu.ItemIndicator>
        <Check className="h-4 w-4" />
      </RadixContextMenu.ItemIndicator>
    </span>
    {children}
  </RadixContextMenu.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem';

const ContextMenuRadioItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixContextMenu.RadioItem>
>(({ className, children, ...props }, ref) => (
  <RadixContextMenu.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-[var(--text-primary)]',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <RadixContextMenu.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </RadixContextMenu.ItemIndicator>
    </span>
    {children}
  </RadixContextMenu.RadioItem>
));
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem';

const ContextMenuLabel = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixContextMenu.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <RadixContextMenu.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold text-[var(--text-primary)]',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
ContextMenuLabel.displayName = 'ContextMenuLabel';

const ContextMenuSeparator = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixContextMenu.Separator>
>(({ className, ...props }, ref) => (
  <RadixContextMenu.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-[var(--border-color)]', className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

function ContextMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-[var(--text-muted)]', className)}
      {...props}
    />
  );
}
ContextMenuShortcut.displayName = 'ContextMenuShortcut';

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
