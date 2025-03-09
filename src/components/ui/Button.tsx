import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-md hover:shadow-lg ',
        success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg ',
        destructive: 'bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg ',
        outline:
          'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm hover:shadow-md ',
        secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 shadow-sm hover:shadow-md ',
        ghost: 'text-zinc-900 hover:bg-zinc-100 hover:shadow-sm ',
        link: 'text-zinc-900 underline-offset-4 hover:underline ',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        disabled={props.disabled || loading}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export default Button;
