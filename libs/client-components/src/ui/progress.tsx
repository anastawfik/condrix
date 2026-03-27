import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Progress as RadixProgress } from 'radix-ui';
import { cn } from '../lib/utils.js';

const Progress = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RadixProgress.Root>>(
  ({ className, value, ...props }, ref) => (
    <RadixProgress.Root
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-[var(--bg-active)]',
        className,
      )}
      {...props}
    >
      <RadixProgress.Indicator
        className="h-full w-full flex-1 bg-[var(--accent-blue)] transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </RadixProgress.Root>
  ),
);
Progress.displayName = 'Progress';

export { Progress };
