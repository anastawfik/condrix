import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './lib/utils.js';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <div>
        <textarea
          ref={ref}
          className={cn(
            'w-full px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-y transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-primary)]',
            error ? 'border-[var(--accent-red)]' : 'border-[var(--border-color)]',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-[10px] text-[var(--accent-red)]">{error}</p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
