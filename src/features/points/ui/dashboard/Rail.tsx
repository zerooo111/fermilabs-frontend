/**
 * The dashboard's side column: claimed points by category as the skill graph,
 * then the wallet's epochs. Sections are divided by rules, not boxed.
 */
import { Eyebrow } from '@/shared/ui/panel';
import type { PointsAccount, PointsAccountEpoch, PointsEpoch } from '../../api/pointsClient';
import { dateUtc, epochName, points } from '../../model/format';
import { SkillGraph } from '../SkillGraph';

const STATUS_LABEL: Record<PointsAccountEpoch['status'], string> = {
  live: 'Live',
  provisional: 'Provisional',
  final: 'Final',
};

export function Rail({
  account,
  rows,
  epochs,
}: {
  account: PointsAccount | undefined;
  rows: PointsAccountEpoch[] | undefined;
  epochs: Map<number, PointsEpoch>;
}) {
  const sorted = [...(rows ?? [])].sort((a, b) => b.epoch - a.epoch);
  return (
    <div className="flex flex-col divide-y divide-outline">
      <section className="px-4 pt-4">
        <Eyebrow>Where they came from</Eyebrow>
        {/* The axis labels sit outside the SVG box, so inset it to keep them in the column. */}
        <div className="px-8 pt-2 pb-4">{account && <SkillGraph account={account} />}</div>
      </section>
      <section className="flex flex-col">
        <Eyebrow className="px-4 pt-4 pb-1">Epochs</Eyebrow>
        {sorted.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-rock/55">No epochs yet.</p>
        ) : (
          <ul className="divide-y divide-outline/60">
            {sorted.map(r => {
              const e = epochs.get(r.epoch);
              const waiting = r.claims.claimable + r.claims.granted;
              return (
                <li key={r.epoch} className="flex flex-col gap-1 px-4 py-3">
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
                      {waiting > 0 ? (
                        <span className="text-amber-200/80">{points(waiting)} unclaimed</span>
                      ) : (
                        `${r.entries} ${r.entries === 1 ? 'entry' : 'entries'}`
                      )}
                    </span>
                    <span className="font-mono tabular-nums text-rock">
                      {points(r.total)} claimed
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
