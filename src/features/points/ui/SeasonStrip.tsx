/**
 * Where the program is, in one line: how long until Season 1 starts earning,
 * and a bar for how much of the wait since the pre-deposit date has passed.
 * Once the season is on, it says so.
 */
import { countdown } from '../model/format';
import { SEASON_START_MS } from '../model/program';

const WAIT_FROM_MS = Date.UTC(2026, 9, 15);

export function SeasonStrip({ now }: { now: number }) {
  const started = now >= SEASON_START_MS;
  const done = Math.min(1, Math.max(0, (now - WAIT_FROM_MS) / (SEASON_START_MS - WAIT_FROM_MS)));

  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-rock">
          <span
            className={
              started
                ? 'mr-2 inline-block size-1.5 rounded-full bg-lichen'
                : 'mr-2 inline-block size-1.5 rounded-full bg-amber-200'
            }
            aria-hidden
          />
          {started ? 'Season 1 is earning now' : 'Season 1 starts 1 Nov'}
        </span>
        {!started && (
          <span className="text-rock/60">
            <span className="font-mono">{countdown(SEASON_START_MS - now)}</span> to go
          </span>
        )}
      </p>
      <div className="h-1 bg-rock/10">
        <div
          className={started ? 'h-full bg-lichen' : 'h-full bg-amber-200'}
          style={{ width: `${done * 100}%` }}
        />
      </div>
    </div>
  );
}
