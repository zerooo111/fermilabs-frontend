import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          'file:text-fg-primary placeholder:text-fg-tertiary selection:bg-state-strong selection:text-fg-primary border border-line flex h-9 w-full min-w-0 bg-surface-sunken px-3 py-1 text-base text-fg-primary shadow-xs transition-[color,box-shadow,border-color] outline-none hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-line-focus file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'aria-invalid:border-negative-line aria-invalid:focus-visible:ring-negative-line',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
