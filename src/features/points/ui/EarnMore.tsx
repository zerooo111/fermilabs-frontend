/**
 * Ways to earn, each with where to go, as full-width rows between dashed
 * rules. Ways that haven't opened say so and show their date instead of a
 * button. With a wallet's account, the ways it already earns from are marked.
 */
import { appHref } from '@/shared/lib/domains';
import { cn } from '@/shared/lib/utils';
import type { PointsAccount } from '../api/pointsClient';
import { points } from '../model/format';
import { EARN_WAYS } from '../model/program';

const OPENS = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const TAG = 'border px-1.5 py-0.5 text-[11px] tracking-wider whitespace-nowrap uppercase';

export function EarnMore({ account, now }: { account?: PointsAccount; now: number }) {
  return (
    <ul className="divide-y divide-dashed divide-rock/20">
      {EARN_WAYS.map(way => {
        const earned = account?.by_category[way.category] ?? 0;
        const live = now >= way.startsAtMs;
        return (
          <li
            key={way.category}
            className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:gap-8 md:px-10"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-serif text-2xl tracking-[-0.01em]">{way.action}</span>
                {earned > 0 ? (
                  <span className={cn(TAG, 'border-lichen/50 text-lichen')}>
                    +{points(earned)} earned
                  </span>
                ) : live ? (
                  <span className={cn(TAG, 'border-amber-200/60 text-amber-200')}>Earning now</span>
                ) : (
                  <span className={cn(TAG, 'border-rock/20 text-rock/60')}>Coming soon</span>
                )}
              </p>
              <p className="mt-1 text-rock/65">{way.pitch}</p>
            </div>
            {live ? (
              <a
                href={appHref(way.href)}
                className="shrink-0 self-start bg-amber-200 px-5 py-2.5 text-center font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100 sm:self-center"
              >
                {way.cta}
              </a>
            ) : (
              // Nothing to do yet: show when it opens instead of a button.
              <span className="shrink-0 self-start border border-dashed border-rock/25 px-5 py-2.5 text-center text-rock/60 sm:self-center">
                Opens {OPENS.format(way.startsAtMs)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
