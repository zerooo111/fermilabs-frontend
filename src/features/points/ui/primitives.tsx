/**
 * Loading and empty states shared by the points page.
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

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
