/**
 * Ways to earn more: what to do, why it pays, what the wallet has earned from
 * it so far, and a way in. Ways that haven't opened show their date instead.
 */
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { landingHref } from '@/shared/lib/domains';
import type { PointsAccount } from '../../api/pointsClient';
import { points } from '../../model/format';
import { EARN_WAYS } from '../../model/program';
import { useNow } from '../../model/useNow';

const OPENS = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const TAG =
  'shrink-0 border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap';

/** The full rules, on the points site. */
export function RulesLink({ className }: { className?: string }) {
  return (
    <a
      href={landingHref('/points/docs')}
      target="_blank"
      rel="noreferrer"
      className={cn('flex items-center gap-1 text-xs text-rock/60 hover:text-rock', className)}
    >
      Read the rules
      <ArrowUpRight className="size-3.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function EarnTab({ account }: { account: PointsAccount | undefined }) {
  const now = useNow();
  return (
    <ul className="divide-y divide-outline">
      {EARN_WAYS.map(way => {
        const earned = account?.by_category[way.category] ?? 0;
        const live = now >= way.startsAtMs;
        return (
          <li key={way.category} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm text-rock">{way.action}</span>
                {earned > 0 ? (
                  <span className={cn(TAG, 'border-lichen/40 text-lichen')}>
                    +{points(earned)} earned
                  </span>
                ) : live ? (
                  <span className={cn(TAG, 'border-amber-200/50 text-amber-200')}>Earning now</span>
                ) : (
                  <span className={cn(TAG, 'border-rock/20 text-rock/55')}>Coming soon</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-rock/55">{way.pitch}</p>
            </div>
            {live ? (
              <Button asChild size="sm" variant="outline" className="w-32">
                <Link to={way.href}>{way.cta}</Link>
              </Button>
            ) : (
              <span className="flex h-8 w-32 shrink-0 items-center justify-center border border-dashed border-rock/25 text-xs text-rock/55">
                Opens {OPENS.format(way.startsAtMs)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
