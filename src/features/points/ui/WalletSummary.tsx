/**
 * One wallet's balance: total and rank, the final / provisional / estimate
 * split, and what each category contributed.
 */
import type { PointsAccount } from '../api/pointsClient';
import { CATEGORY_LABELS, CATEGORY_ORDER, count, points } from '../model/format';
import { Eyebrow } from './primitives';

const STATUS_ROWS = [
  { key: 'final', label: 'Final', hint: "Can't change" },
  { key: 'provisional', label: 'Provisional', hint: 'Under review for 14 days' },
  { key: 'live', label: 'Estimate', hint: 'Current epoch, still accruing' },
] as const;

export function WalletSummary({ account }: { account: PointsAccount }) {
  const positive = CATEGORY_ORDER.map(c => ({ c, v: account.by_category[c] ?? 0 }));
  const max = Math.max(0, ...positive.map(p => p.v));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="grid content-start gap-6">
        <div>
          <Eyebrow>Total points</Eyebrow>
          <p className="mt-2 font-serif text-5xl leading-none font-light tabular-nums md:text-6xl">
            {points(account.total)}
          </p>
          <p className="mt-3 text-sm text-rock/60">
            {account.rank !== null ? (
              <>
                Rank <span className="text-amber-200">#{count(account.rank)}</span> of{' '}
                {count(account.ranked)} wallets
              </>
            ) : (
              'Not ranked yet'
            )}
          </p>
        </div>
        <dl className="divide-y divide-rock/10 border-y border-rock/15">
          {STATUS_ROWS.map(s => (
            <div key={s.key} className="flex items-baseline justify-between gap-4 py-3">
              <dt>
                <span className="text-rock">{s.label}</span>
                <span className="ml-2 text-xs text-rock/45">{s.hint}</span>
              </dt>
              <dd className="font-mono text-sm tabular-nums">{points(account.by_status[s.key])}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <Eyebrow className="mb-3">By category</Eyebrow>
        <ul className="grid gap-3">
          {positive.map(({ c, v }) => (
            <li
              key={c}
              className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3"
            >
              <span className="truncate text-sm text-rock/80">{CATEGORY_LABELS[c]}</span>
              <span className="h-2 bg-rock/10" aria-hidden>
                <span
                  className="block h-full bg-amber-200/80"
                  style={{ width: max > 0 ? `${(Math.max(v, 0) / max) * 100}%` : 0 }}
                />
              </span>
              <span className="min-w-16 text-right font-mono text-sm tabular-nums">
                {points(v)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
