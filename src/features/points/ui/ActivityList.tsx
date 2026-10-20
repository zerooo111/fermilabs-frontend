/**
 * What earned the points, newest first: what happened, when, and how many.
 * Shows the latest few; the rest open on request. Removals show their reason,
 * and points not claimed yet say where they stand.
 */
import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { ClaimStatus, PointsEntry } from '../api/pointsClient';
import { CATEGORY_LABELS, dateUtc, pointsSigned } from '../model/format';

const FIRST = 5;

const CLAIM_TAG: Record<Exclude<ClaimStatus, 'claimed'>, { label: string; className: string }> = {
  claimable: { label: 'Ready to claim', className: 'border-amber-200/50 text-amber-200' },
  granted: { label: 'Pending', className: 'border-rock/25 text-rock/55' },
  expired: { label: 'Expired', className: 'border-rock/20 text-rock/40' },
};

function pointsClass(e: PointsEntry): string {
  if (e.claim_status === 'expired') return 'text-rock/35 line-through';
  if (e.claim_status !== 'claimed') return 'text-rock/55';
  return e.points < 0 ? 'text-danger' : 'text-lichen';
}

export function ActivityList({ entries }: { entries: PointsEntry[] }) {
  const [all, setAll] = useState(false);
  const sorted = [...entries].sort((a, b) => b.occurred_at_ms - a.occurred_at_ms);
  const shown = all ? sorted : sorted.slice(0, FIRST);

  return (
    <div>
      <ul className="divide-y divide-dashed divide-rock/20 border-y border-dashed border-rock/20">
        {shown.map(e => (
          <li key={e.id} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-2">
                <span className="truncate text-rock">
                  {e.description ?? CATEGORY_LABELS[e.category]}
                </span>
                {e.claim_status !== 'claimed' && (
                  <span
                    className={cn(
                      'shrink-0 border px-1.5 py-px text-[10px] tracking-[0.12em] uppercase',
                      CLAIM_TAG[e.claim_status].className
                    )}
                  >
                    {CLAIM_TAG[e.claim_status].label}
                  </span>
                )}
              </p>
              <p className="text-xs text-rock/50">
                {dateUtc(e.occurred_at_ms)}
                {e.market && <> on {e.market}</>}
                {e.reason && <> for {e.reason.replace(/_/g, ' ')}</>}
              </p>
            </div>
            <span className={cn('font-mono text-lg', pointsClass(e))}>
              {pointsSigned(e.points)}
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll(v => !v)}
          className="link mt-4 text-sm text-rock/70"
        >
          {all ? 'Show less' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
