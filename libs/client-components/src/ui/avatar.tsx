import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Avatar as RadixAvatar } from 'radix-ui';
import { cn } from '../lib/utils.js';

const Avatar = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<typeof RadixAvatar.Root>>(
  ({ className, ...props }, ref) => (
    <RadixAvatar.Root
      ref={ref}
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  ),
);
Avatar.displayName = 'Avatar';

const AvatarImage = forwardRef<
  HTMLImageElement,
  ComponentPropsWithoutRef<typeof RadixAvatar.Image>
>(({ className, ...props }, ref) => (
  <RadixAvatar.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = forwardRef<
  HTMLSpanElement,
  ComponentPropsWithoutRef<typeof RadixAvatar.Fallback>
>(({ className, ...props }, ref) => (
  <RadixAvatar.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-[var(--bg-active)] text-[var(--text-secondary)]',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };
