/**
 * Small pieces shared by the points page, in the landing's drawing-sheet
 * style: square corners, hairline rules, spaced uppercase labels.
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

/** A label over a block of content, like the landing hero's kicker. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs tracking-[0.2em] text-rock/60 uppercase', className)}>{children}</p>
  );
}

export function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse bg-rock/10', className)} />;
}

export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-rock/20 px-5 py-8 text-center">
      <p className="text-rock">{title}</p>
      {children && <div className="mt-2 text-sm text-rock/60">{children}</div>}
    </div>
  );
}
