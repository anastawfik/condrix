import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './lib/utils.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<InputProps['inputSize']>, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-2.5 py-1.5 text-xs',
  lg: 'px-3 py-2 text-sm',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, leftIcon, inputSize = 'md', className, ...props }, ref) => {
    return (
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-[var(--bg-input)] border rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-primary)]',
            error ? 'border-[var(--accent-red)]' : 'border-[var(--border-color)]',
            leftIcon && 'pl-8',
            sizeClasses[inputSize],
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-[10px] text-[var(--accent-red)]">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
