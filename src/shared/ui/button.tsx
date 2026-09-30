import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 active:scale-99 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas aria-invalid:ring-2 aria-invalid:ring-negative-line",
  {
    variants: {
      variant: {
        default: 'bg-surface-inverse text-fg-inverse shadow-xs hover:bg-surface-inverse-hover',
        destructive: 'bg-negative-solid text-fg-inverse shadow-xs hover:bg-negative-solid-hover',
        success: 'bg-positive-solid text-fg-inverse shadow-xs hover:bg-positive-solid-hover',
        outline:
          'border border-line bg-transparent text-fg-primary shadow-xs hover:border-line-strong hover:bg-state-hover active:bg-state-pressed',
        secondary:
          'border border-line bg-surface-raised text-fg-primary shadow-xs hover:bg-state-hover active:bg-state-pressed',
        ghost:
          'text-fg-secondary hover:bg-state-hover hover:text-fg-primary active:bg-state-pressed',
        link: 'text-fg-primary underline-offset-4 hover:underline',
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
