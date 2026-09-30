import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

import { cn } from '@/lib/utils';

/**
 * Accent-filled checkbox. The box fills amber on check and the tick draws in
 * via stroke-dashoffset (pathLength=1 normalises the dash math); unchecking
 * reverses it. The SVG is always mounted so both directions animate.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    data-slot="checkbox"
    className={cn(
      'group peer relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-line bg-surface-sunken outline-none',
      'transition-[background-color,border-color,scale] duration-150 ease-out active:scale-90',
      'hover:border-line-strong focus-visible:ring-2 focus-visible:ring-line-focus',
      'data-[state=checked]:border-accent-solid data-[state=checked]:bg-accent-solid',
      'data-[state=checked]:hover:border-accent-solid-hover data-[state=checked]:hover:bg-accent-solid-hover',
      'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
      className
    )}
    {...props}
  >
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-[85%] text-fg-on-accent">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="[stroke-dasharray:1_2] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-200 ease-out group-data-[state=checked]:[stroke-dashoffset:0] group-data-[state=checked]:delay-75 motion-reduce:transition-none"
      />
    </svg>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
