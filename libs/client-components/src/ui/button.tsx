import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-primary)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]',
        secondary:
          'bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-active)]',
        ghost:
          'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
        destructive: 'bg-[var(--accent-red)] text-white hover:opacity-90',
        outline:
          'border border-[var(--border-color)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
        link: 'text-[var(--accent-blue)] underline-offset-4 hover:underline bg-transparent',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 rounded px-2 text-xs',
        lg: 'h-10 rounded px-4',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
