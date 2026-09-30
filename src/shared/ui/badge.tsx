import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-line-focus aria-invalid:border-negative-line transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-line bg-surface-raised text-fg-primary [a&]:hover:bg-state-hover',
        secondary:
          'border-line-subtle bg-surface-overlay text-fg-secondary [a&]:hover:bg-state-hover',
        outline:
          'border-line text-fg-secondary [a&]:hover:bg-state-hover [a&]:hover:text-fg-primary',
        positive: 'border-positive-line bg-positive-muted text-positive-fg',
        negative: 'border-negative-line bg-negative-muted text-negative-fg',
        warning: 'border-warning-line bg-warning-muted text-warning-fg',
        info: 'border-info-line bg-info-muted text-info-fg',
        // Older names, kept so existing call sites keep working.
        success: 'border-positive-line bg-positive-muted text-positive-fg',
        danger: 'border-negative-line bg-negative-muted text-negative-fg',
        destructive: 'border-negative-line bg-negative-muted text-negative-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
