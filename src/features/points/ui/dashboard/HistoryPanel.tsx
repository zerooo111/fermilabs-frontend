/**
 * Every entry the wallet has, newest first, filterable by claim status. A row
 * opens to show what the entry was for: its reason and the metrics the scorer
 * recorded in `details`.
 */
import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Panel } from '@/shared/ui/panel';
import { Segmented } from '@/shared/ui/segmented';
import type { ClaimStatus, PointsEntry, PointsEpoch } from '../../api/pointsClient';
import { CATEGORY_LABELS, dateUtc, epochName, pointsSigned } from '../../model/format';
import { PanelBar, StatusTag } from './primitives';
import { Empty } from './Empty';

type Filter = 'all' | ClaimStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'claimable', label: 'Ready' },
  { value: 'granted', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
];

const label = (key: string) => key.replace(/_/g, ' ');

/** A `details` value as text: arrays joined, objects as JSON. */
function show(v: unknown): string {
  if (Array.isArray(v)) return v.map(show).join(', ');
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function pointsTone(e: PointsEntry): string {
  if (e.claim_status === 'expired') return 'text-rock/40 line-through';
  if (e.claim_status !== 'claimed') return 'text-rock/60';
  return e.points < 0 ? 'text-danger' : 'text-lichen';
}

export function HistoryPanel({
  entries,
  epochs,
  loading,
}: {
  entries: PointsEntry[];
  epochs: Map<number, PointsEpoch>;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<number | null>(null);
  const count = (f: Filter) =>
    f === 'all' ? entries.length : entries.filter(e => e.claim_status === f).length;
  const shown = filter === 'all' ? entries : entries.filter(e => e.claim_status === filter);

  return (
    <Panel>
      <PanelBar
        title="History"
        count={entries.length}
        right={
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
        }
      />
      {loading ? (
        <Empty title="Loading…" />
      ) : shown.length === 0 ? (
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
                const isOpen = open === e.id;
                const details = Object.entries(e.details ?? {});
                const epoch = epochs.get(e.epoch);
                return (
                  <Fragment key={e.id}>
                    <tr
                      onClick={() => setOpen(isOpen ? null : e.id)}
                      className={cn(
                        'cursor-pointer border-b border-outline/60 transition-colors duration-150 hover:bg-rock/[0.03]',
                        isOpen && 'bg-rock/[0.03]'
                      )}
                    >
                      <td className="py-2.5 pr-2 pl-4 font-mono text-xs whitespace-nowrap text-rock/60">
                        {dateUtc(e.occurred_at_ms)}
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          className="flex w-full min-w-0 items-center gap-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                        >
                          <ChevronRight
                            className={cn(
                              'size-3.5 shrink-0 text-rock/40 transition-transform duration-150',
                              isOpen && 'rotate-90'
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 truncate text-rock">
                            {e.description ?? CATEGORY_LABELS[e.category]}
                            <span className="ml-2 text-xs text-rock/50">
                              {CATEGORY_LABELS[e.category]}
                              {e.market && <> · {e.market}</>}
                            </span>
                          </span>
                        </button>
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
                    {isOpen && (
                      <tr className="border-b border-outline/60 bg-rock/[0.03]">
                        <td colSpan={5} className="px-4 pt-1 pb-3 pl-10">
                          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[max-content_1fr]">
                            {e.reason && (
                              <>
                                <dt className="text-rock/50">Reason</dt>
                                <dd className="text-rock/80">{label(e.reason)}</dd>
                              </>
                            )}
                            {details.map(([k, v]) => (
                              <Fragment key={k}>
                                <dt className="text-rock/50 capitalize">{label(k)}</dt>
                                <dd className="font-mono break-all text-rock/80">{show(v)}</dd>
                              </Fragment>
                            ))}
                            <dt className="text-rock/50">Entry</dt>
                            <dd className="font-mono text-rock/60">#{e.id}</dd>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
