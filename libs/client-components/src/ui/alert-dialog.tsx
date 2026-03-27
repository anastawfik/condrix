import { forwardRef, type HTMLAttributes, type ComponentPropsWithoutRef } from 'react';
import { AlertDialog as RadixAlertDialog } from 'radix-ui';
import { cn } from '../lib/utils.js';
import { buttonVariants } from './button.js';

const AlertDialog = RadixAlertDialog.Root;

const AlertDialogTrigger = RadixAlertDialog.Trigger;

const AlertDialogPortal = RadixAlertDialog.Portal;

const AlertDialogOverlay = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixAlertDialog.Overlay>
>(({ className, ...props }, ref) => (
  <RadixAlertDialog.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out',
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = 'AlertDialogOverlay';

const AlertDialogContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixAlertDialog.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <RadixAlertDialog.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-2xl duration-200 data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out rounded-lg focus:outline-none',
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = 'AlertDialogContent';

function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
  );
}
AlertDialogHeader.displayName = 'AlertDialogHeader';

function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof RadixAlertDialog.Title>
>(({ className, ...props }, ref) => (
  <RadixAlertDialog.Title
    ref={ref}
    className={cn('text-lg font-semibold text-[var(--text-primary)]', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

const AlertDialogDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof RadixAlertDialog.Description>
>(({ className, ...props }, ref) => (
  <RadixAlertDialog.Description
    ref={ref}
    className={cn('text-sm text-[var(--text-secondary)]', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = 'AlertDialogDescription';

const AlertDialogAction = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RadixAlertDialog.Action>
>(({ className, ...props }, ref) => (
  <RadixAlertDialog.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RadixAlertDialog.Cancel>
>(({ className, ...props }, ref) => (
  <RadixAlertDialog.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)}
    {...props}
  />
));
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
