import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-outline bg-card text-zinc-100 [a&]:hover:bg-zinc-800',
        secondary: 'border-outline bg-zinc-800 text-zinc-300 [a&]:hover:bg-zinc-700',
        destructive:
          'border-outline bg-red-900/50 text-red-200 [a&]:hover:bg-red-900/70 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        success:
          'border-emerald-700/50 bg-emerald-900/30 text-emerald-400 [a&]:hover:bg-emerald-900/50',
        danger: 'border-red-700/50 bg-red-900/30 text-red-400 [a&]:hover:bg-red-900/50',
        outline: 'border-outline text-zinc-300 [a&]:hover:bg-card [a&]:hover:text-zinc-100',
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
