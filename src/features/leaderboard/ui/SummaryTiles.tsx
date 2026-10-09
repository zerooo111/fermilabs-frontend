/**
 * The three headline numbers above the table: window volume, active traders,
 * and the connected wallet's own rank.
 */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { LeaderboardRank, LeaderboardWindow } from '../api/leaderboardClient';
import { WINDOW_TAG } from '../model/constants';
import { count, usd } from '../model/format';
import { Bone, Eyebrow } from './primitives';

interface Props {
  window: LeaderboardWindow;
  totalVolume?: string;
  totalTraders?: number;
  loading: boolean;
  failed: boolean;
  owner: string | null;
  rank: LeaderboardRank | undefined;
  rankLoading: boolean;
  rankFailed: boolean;
}

export function SummaryTiles({
  window,
  totalVolume,
  totalTraders,
  loading,
  failed,
  owner,
  rank,
  rankLoading,
  rankFailed,
}: Props) {
  const dash = <span className="text-rock/35">—</span>;

  let rankValue: ReactNode;
  let rankHint: ReactNode = null;
  if (!owner) {
    rankValue = <span className="text-base font-normal text-rock/45">Connect wallet</span>;
  } else if (rankFailed) {
    rankValue = dash;
  } else if (!rank?.entry) {
    rankValue = <span className="text-base font-normal text-rock/45">Unranked</span>;
    rankHint = 'Trade to get on the board';
  } else {
    rankValue = (
      <>
        <span className="text-rock/45">#</span>
        {count(rank.entry.rank)}
      </>
    );
    rankHint = `of ${count(rank.total_traders)}`;
  }

  return (
    <div className="grid grid-cols-1 border border-outline sm:grid-cols-3 max-sm:divide-y sm:divide-x divide-outline">
      <Tile
        label={`Volume · ${WINDOW_TAG[window]}`}
        loading={loading}
        value={failed ? dash : usd(totalVolume)}
      />
      <Tile label="Traders" loading={loading} value={failed ? dash : count(totalTraders)} />
      <Tile
        label="Your rank"
        loading={!!owner && rankLoading}
        value={rankValue}
        hint={rankHint}
        accent={!!rank?.entry}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  loading,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5">
      <Eyebrow>{label}</Eyebrow>
      {loading ? (
        <Bone className="h-7 w-28" />
      ) : (
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              'truncate font-mono text-xl font-semibold tabular-nums',
              accent ? 'text-amber-200' : 'text-rock'
            )}
          >
            {value}
          </span>
          {hint && <span className="truncate font-mono text-[11px] text-rock/45">{hint}</span>}
        </div>
      )}
    </div>
  );
}
