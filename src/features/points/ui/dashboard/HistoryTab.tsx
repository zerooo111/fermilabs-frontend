/**
 * Every entry the wallet has, newest first, filterable by claim status.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Segmented } from '@/shared/ui/segmented';
import type { ClaimStatus, PointsEntry, PointsEpoch } from '../../api/pointsClient';
import { CATEGORY_LABELS, dateUtc, epochName, pointsSigned } from '../../model/format';
import { StatusTag } from './primitives';
import { Empty } from './Empty';

type Filter = 'all' | ClaimStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'claimable', label: 'Ready' },
  { value: 'granted', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
];

function pointsTone(e: PointsEntry): string {
  if (e.claim_status === 'expired') return 'text-rock/40 line-through';
  if (e.claim_status !== 'claimed') return 'text-rock/60';
  return e.points < 0 ? 'text-danger' : 'text-lichen';
}

export function HistoryTab({
  entries,
  epochs,
}: {
  entries: PointsEntry[];
  epochs: Map<number, PointsEpoch>;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const count = (f: Filter) =>
    f === 'all' ? entries.length : entries.filter(e => e.claim_status === f).length;
  const shown = filter === 'all' ? entries : entries.filter(e => e.claim_status === filter);

  return (
    <div>
      <div className="flex justify-end border-b border-outline px-4 py-2.5">
        <Segmented<Filter>
          aria-label="Filter by status"
          mono
          value={filter}
          onChange={setFilter}
          className="w-max max-w-full overflow-x-auto"
          options={FILTERS.map(f => ({
            value: f.value,
            label: (
              <span className="flex items-center gap-1.5">
                {f.label}
                <span className="tabular-nums text-rock/55">{count(f.value)}</span>
              </span>
            ),
          }))}
        />
      </div>
      {shown.length === 0 ? (
        <Empty title={entries.length === 0 ? 'No points yet' : 'Nothing here'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-28" />
              <col />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className="border-b border-outline font-mono text-[11px] uppercase tracking-[0.12em] text-rock/50">
                <th className="py-2 pr-2 pl-4 font-normal">Date</th>
                <th className="px-2 py-2 font-normal">Activity</th>
                <th className="px-2 py-2 font-normal">Epoch</th>
                <th className="px-2 py-2 font-normal">Status</th>
                <th className="py-2 pr-4 pl-2 text-right font-normal">Points</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(e => {
                const epoch = epochs.get(e.epoch);
                return (
                  <tr key={e.id} className="border-b border-outline/60">
                    <td className="py-2.5 pr-2 pl-4 font-mono text-xs whitespace-nowrap text-rock/60">
                      {dateUtc(e.occurred_at_ms)}
                    </td>
                    <td className="truncate px-2 py-2.5 text-rock">
                      {e.description ?? CATEGORY_LABELS[e.category]}
                      <span className="ml-2 text-xs text-rock/50">
                        {CATEGORY_LABELS[e.category]}
                        {e.market && <> · {e.market}</>}
                        {e.reason && <> · {e.reason.replace(/_/g, ' ')}</>}
                      </span>
                    </td>
                    <td className="truncate px-2 py-2.5 text-xs whitespace-nowrap text-rock/60">
                      {epoch ? epochName(epoch) : `Epoch ${e.epoch}`}
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusTag status={e.claim_status} />
                    </td>
                    <td
                      className={cn(
                        'py-2.5 pr-4 pl-2 text-right font-mono tabular-nums whitespace-nowrap',
                        pointsTone(e)
                      )}
                    >
                      {pointsSigned(e.points)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
