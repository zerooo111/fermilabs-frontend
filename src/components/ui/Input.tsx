import * as React from 'react';

import { cn } from '@/utils/cn';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex w-full rounded-md p-2 bg-zinc-100 focus:outline-none ring-1 ring-zinc-300 font-medium text-zinc-600 focus:bg-white focus:shadow-lg focus:text-zinc-900 focus:font-bold duration-100 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 focus:scale-101',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export default Input;
