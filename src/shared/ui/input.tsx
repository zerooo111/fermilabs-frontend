import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-zinc-100 placeholder:text-zinc-500 selection:bg-primary selection:text-primary-foreground border border-outline flex h-9 w-full min-w-0 bg-card px-3 py-1 text-base text-zinc-100 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
  );
}

export { Input };
