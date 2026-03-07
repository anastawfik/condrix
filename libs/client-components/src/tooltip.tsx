import type { ReactNode, ComponentPropsWithoutRef } from 'react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { cn } from './lib/utils.js';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>
        {children}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={4}
          className={cn(
            'z-50 px-2 py-1 text-[10px] text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded shadow-lg whitespace-nowrap data-[state=delayed-open]:animate-tooltip-in data-[state=closed]:animate-tooltip-out',
            className,
          )}
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

/* Re-export Provider for app roots */
export const TooltipProvider = RadixTooltip.Provider;

/* ─── Compound API for advanced usage ────────────────────────────────────── */

export const TooltipRoot = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTooltip.Content>) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 px-2 py-1 text-[10px] text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded shadow-lg whitespace-nowrap data-[state=delayed-open]:animate-tooltip-in data-[state=closed]:animate-tooltip-out',
          className,
        )}
        {...props}
      />
    </RadixTooltip.Portal>
  );
}
TooltipContent.displayName = 'TooltipContent';
