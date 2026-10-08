import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-amber-200 focus-visible:outline-offset-2 aria-invalid:border-danger",
  {
    variants: {
      variant: {
        default: 'bg-amber-200 font-semibold text-dark-forest hover:bg-amber-100',
        destructive: 'bg-danger font-semibold text-background hover:brightness-110',
        success: 'bg-success font-semibold text-background hover:brightness-110',
        outline:
          'border border-outline bg-transparent text-rock hover:bg-rock/5 hover:border-rock/40',
        secondary: 'bg-rock/10 text-rock hover:bg-rock/15',
        ghost: 'text-rock/80 hover:bg-rock/5 hover:text-rock',
        link: 'text-amber-200 underline-offset-4 hover:text-amber-100 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5 text-xs',
        lg: 'h-10 px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button };
