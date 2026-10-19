/**
 * The top of the season ranking. Addresses are shortened; each row opens that
 * wallet's points.
 */
import { Link } from 'react-router-dom';
import { points, shortAddress } from '../model/format';
import { usePointsLeaderboard } from '../model/usePoints';
import { Bone, Notice } from './primitives';

export function TopWallets({ limit = 10 }: { limit?: number }) {
  const { data, isPending, isError } = usePointsLeaderboard(limit);

  if (isPending) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (isError) return <Notice title="Couldn't load the ranking. Try again shortly." />;
  if (data.rows.length === 0) {
    return (
      <Notice title="No points awarded yet">The ranking fills in after the first epoch.</Notice>
    );
  }

  return (
    <ol className="divide-y divide-rock/10 border-y border-rock/15">
      {data.rows.map(r => (
        <li key={r.wallet}>
          <Link
            to={`/points/${r.wallet}`}
            className="flex items-center gap-4 py-3 transition-colors duration-150 hover:bg-white/5"
          >
            <span className="w-10 shrink-0 pl-2 font-mono text-sm tabular-nums text-rock/50">
              {r.rank}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-sm" title={r.wallet}>
              {shortAddress(r.wallet)}
            </span>
            <span className="pr-2 font-mono text-sm tabular-nums text-rock">
              {points(r.points)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
