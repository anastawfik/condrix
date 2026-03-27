import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './lib/utils.js';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <label
        className={cn(
          'inline-flex items-center gap-2 cursor-pointer text-xs text-[var(--text-primary)]',
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          className="w-3.5 h-3.5 rounded border-[var(--border-color)] bg-[var(--bg-input)] accent-[var(--accent-blue)]"
          {...props}
        />
        {label && <span>{label}</span>}
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
