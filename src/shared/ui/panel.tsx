/**
 * Shared panel primitives, first built for the referral dashboard and now
 * used by the vaults pages too.
 *
 * Flat, unfilled panels that sit on the canvas, framed by border-line, with a
 * surface-raised header strip. No rounded cards. See /design-system.
 */
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Keyboard focus ring for hand-built interactive elements. Shared controls have it built in. */
export const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-line-focus';

/** A flat bordered panel — the dashboard's primary surface. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('flex flex-col border border-line', className)}>{children}</section>
  );
}

export function PanelHeader({
  icon: Icon,
  title,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex h-11 items-center gap-2 border-b border-line-subtle bg-surface-raised px-4">
      <Icon className="size-3.5 text-fg-tertiary" />
      <span className="text-sm font-medium text-fg-primary">{title}</span>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

/** Mono uppercase eyebrow label — one tracking value across the feature. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-mono text-[11px] uppercase tracking-[0.12em] text-fg-tertiary',
        className
      )}
    >
      {children}
    </span>
  );
}

export function PanelEmpty({
  loading,
  children,
}: {
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-fg-secondary">
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Loading…
        </>
      ) : (
        children
      )}
    </div>
  );
}
