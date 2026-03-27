import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Switch as RadixSwitch } from 'radix-ui';
import { cn } from '../lib/utils.js';

const Switch = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof RadixSwitch.Root>>(
  ({ className, ...props }, ref) => (
    <RadixSwitch.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--accent-blue)] data-[state=unchecked]:bg-[var(--bg-input)]',
        className,
      )}
      {...props}
      ref={ref}
    >
      <RadixSwitch.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        )}
      />
    </RadixSwitch.Root>
  ),
);
Switch.displayName = 'Switch';

export { Switch };
