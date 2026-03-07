import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { cn } from '../lib/utils.js';

const TooltipProvider = RadixTooltip.Provider;

const Tooltip = RadixTooltip.Root;

const TooltipTrigger = RadixTooltip.Trigger;

const TooltipContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <RadixTooltip.Portal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-lg data-[state=delayed-open]:animate-tooltip-in data-[state=closed]:animate-tooltip-out',
        className,
      )}
      {...props}
    />
  </RadixTooltip.Portal>
));
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
