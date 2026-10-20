/**
 * Layout pieces for the points dashboard, in the trading app's visual
 * language: hairline rules, mono eyebrows and tabular mono numbers.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow } from '@/shared/ui/panel';
import type { ClaimStatus } from '../../api/pointsClient';
import { CLAIM_LABELS } from '../../model/format';

export function Bone({ className }: { className?: string }) {
  return <span className={cn('skeleton-bone block motion-reduce:animate-none!', className)} />;
}

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
      <Eyebrow>{label}</Eyebrow>
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
          {hint && <span className="truncate font-mono text-[11px] text-rock/60">{hint}</span>}
        </div>
      )}
    </div>
  );
}

const STATUS_TONE: Record<ClaimStatus, string> = {
  claimable: 'border-amber-200/50 text-amber-200',
  granted: 'border-rock/25 text-rock/60',
  claimed: 'border-lichen/40 text-lichen',
  expired: 'border-rock/20 text-rock/40',
};

export function StatusTag({ status }: { status: ClaimStatus }) {
  return (
    <span
      className={cn(
        'inline-block shrink-0 border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap',
        STATUS_TONE[status]
      )}
    >
      {CLAIM_LABELS[status]}
    </span>
  );
}
