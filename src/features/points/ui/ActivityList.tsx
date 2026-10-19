/**
 * What earned the points: one row per ledger entry, newest first. Removals
 * (negative points) show their reason.
 */
import type { PointsEntry } from '../api/pointsClient';
import { CATEGORY_LABELS, dateUtc, detailPairs, epochLabel, pointsSigned } from '../model/format';
import { usePointsActivity } from '../model/usePoints';
import { Bone, Notice, StatusChip } from './primitives';
import { cn } from '@/shared/lib/utils';

function EntryRow({ e }: { e: PointsEntry }) {
  const details = detailPairs(e.details);
  const title = e.description ?? CATEGORY_LABELS[e.category];
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-rock">{title}</span>
          {e.market && <span className="font-mono text-xs text-rock/60">{e.market}</span>}
        </p>
        <p className="mt-1 text-xs text-rock/50">
          {CATEGORY_LABELS[e.category]} · {dateUtc(e.occurred_at_ms)} ·{' '}
          {epochLabel({ epoch: e.epoch, name: null })}
          {e.reason && <span className="text-rock/70"> · {e.reason.replace(/_/g, ' ')}</span>}
        </p>
        {details.length > 0 && (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {details.map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <dt className="text-rock/55">{k}</dt>
                <dd className="font-mono text-rock/75">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            e.points < 0 ? 'text-danger' : 'text-amber-200'
          )}
        >
          {pointsSigned(e.points)}
        </span>
        <StatusChip status={e.status} />
      </div>
    </li>
  );
}

export function ActivityList({ wallet }: { wallet: string }) {
  const q = usePointsActivity(wallet);

  if (q.isPending) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-16" />
        ))}
      </div>
    );
  }
  if (q.isError) return <Notice title="Couldn't load activity." />;

  const entries = q.data.pages.flatMap(p => p.entries);
  if (entries.length === 0) {
    return (
      <Notice title="No activity yet">
        Deposits in the FLP vault, trading, resting orders and referrals show up here.
      </Notice>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-rock/10 border-y border-rock/15">
        {entries.map(e => (
          <EntryRow key={e.id} e={e} />
        ))}
      </ul>
      {q.hasNextPage && (
        <button
          type="button"
          onClick={() => void q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="mt-4 border border-rock/25 px-4 py-2 text-sm text-rock/80 transition-colors duration-150 hover:border-amber-200 hover:text-amber-100 disabled:opacity-50"
        >
          {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
