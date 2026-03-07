import { cn } from './lib/utils.js';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ orientation = 'horizontal', className }: DividerProps) {
  return orientation === 'horizontal' ? (
    <div className={cn('h-px bg-[var(--border-color)]', className)} role="separator" />
  ) : (
    <div className={cn('w-px bg-[var(--border-color)] self-stretch', className)} role="separator" />
  );
}
