import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-outline bg-card text-rock [a&]:hover:bg-rock/10',
        secondary: 'border-outline bg-rock/10 text-rock/80 [a&]:hover:bg-rock/15',
        destructive: 'border-danger/40 bg-danger/15 text-danger [a&]:hover:bg-danger/25',
        success: 'border-success/40 bg-success/15 text-success [a&]:hover:bg-success/25',
        danger: 'border-danger/40 bg-danger/15 text-danger [a&]:hover:bg-danger/25',
        outline: 'border-outline text-rock/80 [a&]:hover:bg-rock/5 [a&]:hover:text-rock',
        amber: 'border-amber-200/60 text-amber-200',
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
