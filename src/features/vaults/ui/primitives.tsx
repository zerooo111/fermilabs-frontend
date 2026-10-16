/**
 * Layout primitives for the vaults pages, in the terminal's visual language:
 * flat `border-outline` panels, `bg-card` header bars, mono eyebrows, square
 * corners, tabular mono numbers.
 */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Eyebrow } from '@/shared/ui/panel';

export { Eyebrow };

/** Shimmer placeholder; static when the user prefers reduced motion. */
export function Bone({ className }: { className?: string }) {
  return <span className={cn('skeleton-bone block motion-reduce:animate-none!', className)} />;
}

export const DASH = <span className="text-rock/35">—</span>;

/** One headline number in a ruled strip of tiles. */
export function Tile({
  label,
  value,
  hint,
  loading,
  className,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 px-4 py-3.5', className)}>
      <Eyebrow className="flex items-center gap-2">{label}</Eyebrow>
      {loading ? (
        <Bone className="h-7 w-28" />
      ) : (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={cn(
              'whitespace-nowrap font-mono text-lg font-semibold tabular-nums text-rock sm:text-xl',
              valueClassName
            )}
          >
            {value}
          </span>
          {hint && <span className="truncate font-mono text-[11px] text-rock/45">{hint}</span>}
        </div>
      )}
    </div>
  );
}

/** A panel's title bar: `bg-card` strip with an optional right slot. */
export function PanelBar({
  title,
  count,
  right,
  className,
}: {
  title: ReactNode;
  count?: number;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-outline bg-card px-3 py-1.5 sm:px-4',
        className
      )}
    >
      <h2 className="flex items-center gap-2 text-sm text-rock">
        {title}
        {count !== undefined && (
          <span className="font-mono text-[11px] tabular-nums text-rock/45">{count}</span>
        )}
      </h2>
      {right}
    </div>
  );
}

/** A key/value row in a ruled definition list. */
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-xs text-rock/55">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-xs text-rock/85 tabular-nums">
        {children}
      </dd>
    </div>
  );
}
