import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--accent-blue)] text-white',
        secondary: 'border-transparent bg-[var(--bg-active)] text-[var(--text-primary)]',
        destructive: 'border-transparent bg-[var(--accent-red)] text-white',
        outline: 'border-[var(--border-color)] text-[var(--text-primary)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
