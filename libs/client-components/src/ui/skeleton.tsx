import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[var(--bg-active)]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
