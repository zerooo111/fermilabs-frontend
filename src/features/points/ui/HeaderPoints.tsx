/**
 * The connected wallet's points in the app header: a chip beside the balances
 * that links to the points dashboard and flags points ready to claim.
 */
import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { points } from '../model/format';
import { usePointsAccount } from '../model/usePoints';

const DASHBOARD_PATH = '/dashboard/points';

const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function usePointsSummary() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const { data } = usePointsAccount(wallet);
  return { wallet, account: data, claimable: data?.claims.claimable ?? 0 };
}

/** The points mark: three strokes fanning down from one point. */
function PointsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="30 30 180 180" className={className} aria-hidden>
      {/* Non-scaling stroke keeps the lines crisp at icon size, where the
          source's 5-unit stroke on a 240 box would be under half a pixel. */}
      <g
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="120" y1="40" x2="40" y2="200" vectorEffect="non-scaling-stroke" />
        <line x1="120" y1="40" x2="120" y2="200" vectorEffect="non-scaling-stroke" />
        <line x1="120" y1="40" x2="200" y2="200" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

/** Header chip: score at a glance, with a dot when there's something to claim. */
export function PointsChip({ className }: { className?: string }) {
  const { wallet, account, claimable } = usePointsSummary();
  if (!wallet) return null;

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn('gap-2 px-2.5 font-mono tabular-nums', className)}
    >
      <Link
        to={DASHBOARD_PATH}
        aria-label={`Points${account ? `, ${points(account.total)}` : ''}${
          claimable > 0 ? ', ready to claim' : ''
        }`}
      >
        <span className="relative flex items-center">
          <PointsIcon className="size-3.5 text-primary" />
          {claimable > 0 && (
            <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-lichen ring-1 ring-background animate-pulse" />
          )}
        </span>
        <span className="flex items-baseline gap-1">
          {account ? (
            <span className="text-sm" title={points(account.total)}>
              {COMPACT.format(account.total)}
            </span>
          ) : (
            <span className="text-rock/40 text-sm">——</span>
          )}
          <span className="text-[10px] text-rock/50 font-sans">PTS</span>
        </span>
      </Link>
    </Button>
  );
}
