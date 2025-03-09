import * as React from 'react';

import { cn } from '@/utils/cn';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex outline-none px-3 py-2 ring-1 rounded-xl ring-zinc-300 focus:ring-zinc-400   duration-100',
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
