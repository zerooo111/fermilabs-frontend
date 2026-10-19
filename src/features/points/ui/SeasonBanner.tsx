/**
 * A thin banner under the header until Season 1 starts: when it starts and a
 * live countdown. Gone once the season is on.
 */
import { Countdown } from './Countdown';
import { SEASON_START_MS } from '../model/program';

export function SeasonBanner({ now }: { now: number }) {
  if (now >= SEASON_START_MS) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rock/15 bg-amber-200/[0.06] px-5 py-2.5 text-sm md:px-10">
      <p className="text-rock/85">
        <span
          className="mr-2 inline-block size-1.5 rounded-full bg-amber-200 align-middle"
          aria-hidden
        />
        Season 1 starts 1 Nov
      </p>
      <p className="text-rock/60">
        Starts in <Countdown to={SEASON_START_MS} className="ml-1 font-mono text-amber-200" />
      </p>
    </div>
  );
}
