/**
 * The dashboard's right rail: claimed points by category as the skill graph,
 * the wallet's epochs, and how claiming works.
 */
import { Panel } from '@/shared/ui/panel';
import type { PointsAccount, PointsAccountEpoch, PointsEpoch } from '../../api/pointsClient';
import { dateUtc, epochName, points } from '../../model/format';
import { SkillGraph } from '../SkillGraph';
import { PanelBar } from './primitives';
import { Empty } from './Empty';

export function CategoryPanel({ account }: { account: PointsAccount | undefined }) {
  return (
    <Panel>
      <PanelBar title="By category" />
      {account ? (
        // The axis labels sit outside the SVG box, so inset it to keep them in the panel.
        <div className="px-12 py-6">
          <SkillGraph account={account} />
        </div>
      ) : (
        <Empty title="Loading…" />
      )}
    </Panel>
  );
}

const STATUS_LABEL: Record<PointsAccountEpoch['status'], string> = {
  live: 'Live',
  provisional: 'Provisional',
  final: 'Final',
};

export function EpochsPanel({
  rows,
  epochs,
}: {
  rows: PointsAccountEpoch[] | undefined;
  epochs: Map<number, PointsEpoch>;
}) {
  const sorted = [...(rows ?? [])].sort((a, b) => b.epoch - a.epoch);
  return (
    <Panel>
      <PanelBar title="Epochs" count={sorted.length} />
      {sorted.length === 0 ? (
        <Empty title="No epochs yet" />
      ) : (
        <ul className="divide-y divide-outline">
          {sorted.map(r => {
            const e = epochs.get(r.epoch);
            const waiting = r.claims.claimable + r.claims.granted;
            return (
              <li key={r.epoch} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-rock">
                    {e ? epochName(e) : `Epoch ${r.epoch}`}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-rock/55">
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {e && (
                  <p className="font-mono text-[11px] text-rock/50">
                    {dateUtc(e.starts_at_ms)} – {dateUtc(e.ends_at_ms)}
                  </p>
                )}
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-rock/55">
                    {r.entries} {r.entries === 1 ? 'entry' : 'entries'}
                    {waiting > 0 && (
                      <span className="text-amber-200/80"> · {points(waiting)} unclaimed</span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums text-rock">{points(r.total)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const STEPS: [string, string][] = [
  ['Pending', 'Earned from trading this epoch. Becomes claimable when the epoch closes.'],
  ['Ready to claim', 'Claim it to add it to your total and rank.'],
  ['Claimed', 'Counts toward your total, rank and the leaderboard.'],
  ['Expired', 'Not claimed in time. It no longer counts.'],
];

export function HowClaimingWorks() {
  return (
    <Panel>
      <PanelBar title="How claiming works" />
      <dl className="flex flex-col gap-3 px-4 py-4 text-xs">
        {STEPS.map(([t, d]) => (
          <div key={t} className="flex flex-col gap-0.5">
            <dt className="text-rock/85">{t}</dt>
            <dd className="leading-relaxed text-rock/55">{d}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
