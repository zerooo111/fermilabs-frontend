/**
 * Where the program is right now, in one line: the period that is earning,
 * how long it has left, and a bar for how much of it has passed.
 */
import type { PointsEpoch } from '../api/pointsClient';
import { countdown, epochLabel } from '../model/format';
import { usePointsEpochs } from '../model/usePoints';

/** The live epoch; otherwise the next upcoming one. */
function currentEpoch(epochs: PointsEpoch[]): PointsEpoch | undefined {
  return epochs.find(e => e.status === 'live') ?? epochs.find(e => e.status === 'upcoming');
}

export function SeasonStrip({ now }: { now: number }) {
  const { data: epochs } = usePointsEpochs();
  const current = epochs && currentEpoch(epochs);
  if (!current) return null;

  const live = current.status === 'live';
  const span = current.ends_at_ms - current.starts_at_ms;
  const done = live ? Math.min(1, Math.max(0, (now - current.starts_at_ms) / span)) : 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-rock">
          <span
            className={
              live
                ? 'mr-2 inline-block size-2 animate-pulse rounded-full bg-lichen motion-reduce:animate-none'
                : 'mr-2 inline-block size-2 rounded-full bg-rock/40'
            }
            aria-hidden
          />
          {epochLabel(current)} {live ? 'is earning now' : 'is next'}
        </span>
        <span className="tabular-nums text-rock/60">
          {live
            ? `${countdown(current.ends_at_ms - now)} left`
            : `Starts in ${countdown(current.starts_at_ms - now)}`}
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-rock/10">
        <div className="h-full rounded-full bg-lichen" style={{ width: `${done * 100}%` }} />
      </div>
    </div>
  );
}
