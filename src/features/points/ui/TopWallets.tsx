/**
 * The top of the season ranking, each wallet with its alien. Rows open that
 * wallet's points; the checked wallet, if listed, is marked.
 */
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { points, shortAddress, walletPointsPath } from '../model/format';
import { usePointsLeaderboard } from '../model/usePoints';
import { PixelAlien } from './PixelAlien';
import { Bone, Notice } from './primitives';

export function TopWallets({ limit = 10, current }: { limit?: number; current?: string }) {
  const { data, isPending, isError } = usePointsLeaderboard(limit);

  if (isPending) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }
  if (isError) return <Notice title="Couldn't load the ranking. Try again shortly." />;
  if (data.rows.length === 0) {
    return <Notice title="No points yet">The ranking fills in as points are awarded.</Notice>;
  }

  return (
    <ol className="grid gap-1">
      {data.rows.map(r => {
        const mine = r.wallet === current;
        return (
          <li key={r.wallet}>
            <Link
              to={walletPointsPath(r.wallet)}
              aria-current={mine ? 'true' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-rock/5',
                mine && 'bg-lichen/10 hover:bg-lichen/15'
              )}
            >
              <span className="w-7 shrink-0 text-right tabular-nums text-rock/50">{r.rank}</span>
              <PixelAlien wallet={r.wallet} className="h-6 w-8" />
              <span className="min-w-0 flex-1 truncate font-mono text-sm" title={r.wallet}>
                {shortAddress(r.wallet)}
                {mine && <span className="ml-2 font-sans text-xs text-lichen">You checked</span>}
              </span>
              <span className="tabular-nums text-rock">{points(r.points)}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
