import type { ReactNode } from 'react';
import { cn } from './lib/utils.js';

export interface FormGroupProps {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormGroup({ label, error, children, className }: FormGroupProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm text-[var(--text-secondary)]">{label}</label>
      {children}
      {error && (
        <p className="text-[10px] text-[var(--accent-red)]">{error}</p>
      )}
    </div>
  );
}
