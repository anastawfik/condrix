import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Popover as RadixPopover } from 'radix-ui';
import { cn } from '../lib/utils.js';

const Popover = RadixPopover.Root;

const PopoverTrigger = RadixPopover.Trigger;

const PopoverAnchor = RadixPopover.Anchor;

const PopoverContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <RadixPopover.Portal>
    <RadixPopover.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 text-[var(--text-primary)] shadow-xl outline-none data-[state=open]:animate-dropdown-in data-[state=closed]:animate-dropdown-out',
        className,
      )}
      {...props}
    />
  </RadixPopover.Portal>
));
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
