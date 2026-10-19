/**
 * What earned the points, newest first: what happened, when, and how many.
 * Shows the latest few; the rest open on request. Removals show their reason.
 */
import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { PointsEntry } from '../api/pointsClient';
import { CATEGORY_LABELS, dateUtc, pointsSigned } from '../model/format';

const FIRST = 5;

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
              <p className="truncate text-rock">{e.description ?? CATEGORY_LABELS[e.category]}</p>
              <p className="text-xs text-rock/50">
                {dateUtc(e.occurred_at_ms)}
                {e.market && <> on {e.market}</>}
                {e.reason && <> for {e.reason.replace(/_/g, ' ')}</>}
              </p>
            </div>
            <span className={cn('font-mono text-lg', e.points < 0 ? 'text-danger' : 'text-lichen')}>
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
