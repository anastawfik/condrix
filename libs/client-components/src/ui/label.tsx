import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Label as RadixLabel } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const labelVariants = cva(
  'text-sm font-medium leading-none text-[var(--text-primary)] peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

const Label = forwardRef<
  HTMLLabelElement,
  ComponentPropsWithoutRef<typeof RadixLabel.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <RadixLabel.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
