/**
 * Small building blocks shared by the points pages. They wear the landing
 * chrome: cream rules on forest, mono eyebrows, amber for emphasis.
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import type { EpochStatus } from '../api/pointsClient';
import { STATUS_LABELS } from '../model/format';

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('font-mono text-xs uppercase tracking-[0.15em] text-rock/50', className)}>
      {children}
    </p>
  );
}

/** A full-width band between horizontal rules, inside the page frame. */
export function Band({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className="w-full border-b border-rock/15">
      <div className={cn('px-5 py-8 md:px-10 md:py-10', className)}>{children}</div>
    </section>
  );
}

const STATUS_TONE: Record<EpochStatus, string> = {
  upcoming: 'border-rock/20 text-rock/50',
  live: 'border-amber-200/50 text-amber-200',
  computing: 'border-rock/30 text-rock/70',
  provisional: 'border-lichen/50 text-lichen',
  final: 'border-rock/40 text-rock',
};

export function StatusChip({ status }: { status: EpochStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] whitespace-nowrap',
        STATUS_TONE[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
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
