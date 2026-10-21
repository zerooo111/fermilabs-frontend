/**
 * The connected wallet's points in the app header: a chip beside the balances
 * and a summary row in the account menu. Both link to the points dashboard
 * and flag points that are ready to claim.
 */
import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { DropdownMenuItem } from '@/shared/ui/dropdown-menu';
import { points } from '../model/format';
import { usePointsAccount } from '../model/usePoints';
import { PixelAlien } from './PixelAlien';

const DASHBOARD_PATH = '/dashboard/points';
const EYEBROW = 'font-mono text-[10px] uppercase tracking-[0.15em] text-rock/55';

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
          <PixelAlien wallet={wallet} className="h-3 w-auto" />
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

/** Account-menu row: total, rank and a claim prompt. */
export function PointsMenuItem() {
  const { wallet, account, claimable } = usePointsSummary();
  if (!wallet) return null;

  return (
    <DropdownMenuItem asChild className="flex-col items-stretch gap-1 py-2">
      <Link to={DASHBOARD_PATH}>
        <span className="flex items-center justify-between">
          <span className={EYEBROW}>Points</span>
          {account?.rank != null && (
            <span className="font-mono text-[10px] tabular-nums text-rock/55">
              #{account.rank.toLocaleString()} of {account.ranked.toLocaleString()}
            </span>
          )}
        </span>
        <span className="flex items-baseline justify-between">
          <span className="font-mono text-sm tabular-nums text-rock">
            {account ? points(account.total) : '——'}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs',
              claimable > 0 ? 'text-lichen' : 'text-rock/60'
            )}
          >
            {claimable > 0 ? `Claim ${points(claimable)}` : 'Dashboard'}
            <ArrowUpRight className="size-3 text-current" />
          </span>
        </span>
      </Link>
    </DropdownMenuItem>
  );
}
