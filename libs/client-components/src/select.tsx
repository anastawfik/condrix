import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './lib/utils.js';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'w-full px-3 py-2 text-sm bg-[var(--bg-input)] border rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] appearance-none pr-8 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-primary)]',
            error ? 'border-[var(--accent-red)]' : 'border-[var(--border-color)]',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        {error && (
          <p className="mt-1 text-[10px] text-[var(--accent-red)]">{error}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
