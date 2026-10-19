/**
 * Ways to earn, each with where to go. With a wallet's account, the ways it
 * already earns from are marked, so the rest read as what to do next.
 */
import { appHref } from '@/shared/lib/domains';
import { cn } from '@/shared/lib/utils';
import type { PointsAccount } from '../api/pointsClient';
import { countdown, points } from '../model/format';
import { EARN_WAYS } from '../model/program';

export function EarnMore({ account, now }: { account?: PointsAccount; now: number }) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-xl border border-rock/10 bg-rock/10">
      {EARN_WAYS.map(way => {
        const earned = account?.by_category[way.category] ?? 0;
        const live = now >= way.startsAtMs;
        return (
          <li
            key={way.category}
            className="flex flex-col gap-3 bg-background p-4 sm:flex-row sm:items-center sm:gap-6 md:px-6"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-lg text-rock">{way.action}</span>
                {earned > 0 ? (
                  <span className="rounded-full bg-lichen/15 px-2 py-0.5 text-xs text-lichen">
                    +{points(earned)} earned
                  </span>
                ) : live ? (
                  <span className="rounded-full bg-amber-200/15 px-2 py-0.5 text-xs text-amber-200">
                    Earning now
                  </span>
                ) : (
                  <span className="rounded-full bg-rock/10 px-2 py-0.5 text-xs text-rock/60">
                    Starts in {countdown(way.startsAtMs - now)}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-rock/60">{way.pitch}</p>
            </div>
            <a
              href={appHref(way.href)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors duration-150',
                live
                  ? 'bg-amber-200 text-dark-forest hover:bg-amber-100'
                  : 'border border-rock/20 text-rock/80 hover:border-rock/40 hover:text-rock'
              )}
            >
              {way.cta}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
