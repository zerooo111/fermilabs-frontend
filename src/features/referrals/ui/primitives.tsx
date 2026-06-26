/**
 * Shared layout primitives for the referral dashboard.
 *
 * Visual language follows the trading terminal: flat panels delineated by thin
 * `border-outline` dividers with a subtle `bg-card` header — no rounded cards,
 * no tinted fills.
 *
 * Note: the app-wide `ring` / `accent` design tokens are undefined in the
 * Tailwind theme, so the shared Button's default focus ring and ghost hover are
 * no-ops. Until those are defined globally we patch focus locally with
 * `FOCUS_RING` (built from the defined `rock` token) on interactive elements.
 */
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Keyboard-focus ring built from defined tokens (app `ring` token is unset). */
export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-rock/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** A flat bordered panel — the dashboard's primary surface. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('flex flex-col border border-outline', className)}>{children}</section>
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
    <div className="flex h-11 items-center gap-2 border-b border-outline bg-card px-4">
      <Icon className="size-3.5 text-white/50" />
      <span className="text-sm font-medium text-rock">{title}</span>
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
      className={cn('font-mono text-[11px] uppercase tracking-[0.12em] text-white/50', className)}
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
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-white/55">
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
