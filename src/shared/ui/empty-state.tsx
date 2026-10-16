import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DitherRidge } from './dither-ridge';

/**
 * Quiet, centred one-liner for panes with nothing to show yet, over a faint
 * dithered depth ridge rising from the pane's floor. The ridge stays in the
 * bottom fifth so the message always sits on clean background.
 */
export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex h-full min-h-24 items-center justify-center overflow-hidden p-4',
        className
      )}
    >
      <DitherRidge
        // Each message gets its own ridge, so neighbouring panes don't repeat
        seed={typeof children === 'string' ? children : 1}
        className="absolute inset-x-0 bottom-0 h-[24%] max-h-20 text-lichen"
      />
      <p className="relative text-xs text-rock/45">{children}</p>
    </div>
  );
}
