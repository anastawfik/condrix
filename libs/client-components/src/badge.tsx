import type { HTMLAttributes } from 'react';
import { cn } from './lib/utils.js';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[var(--bg-active)] text-[var(--text-secondary)]',
  success: 'bg-[var(--bg-active)] text-[var(--accent-green)]',
  warning: 'bg-[var(--bg-active)] text-[var(--accent-yellow)]',
  danger: 'bg-[var(--bg-active)] text-[var(--accent-red)]',
  info: 'bg-[var(--bg-active)] text-[var(--accent-blue)]',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[10px] rounded font-medium uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
