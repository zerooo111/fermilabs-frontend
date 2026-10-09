/**
 * Ranked trader table. Numbers are right-aligned tabular mono; the active sort
 * column reads at full ink. The connected wallet's row is marked in place and,
 * when it isn't among the loaded rows, pinned above rank #1.
 */
import { cn } from '@/lib/utils';
import { AccountAvatar } from '@/features/wallet-connect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

import type { LeaderboardEntry, LeaderboardSort } from '../api/leaderboardClient';
import { count, makerShare, shortOwner, usd, usdCompact } from '../model/format';
import { Bone, Eyebrow } from './primitives';

const TH = 'h-9 px-2 sm:px-4';
const TD = 'px-2 py-2.5 sm:px-4';
/** Maker/taker split only earns its width on wider screens. */
const SPLIT = 'hidden md:table-cell';

interface Props {
  entries: LeaderboardEntry[];
  sort: LeaderboardSort;
  owner: string | null;
  /** The caller's own entry, shown pinned when it isn't in `entries`. */
  pinned: LeaderboardEntry | null;
  loading: boolean;
}

export function LeaderboardTable({ entries, sort, owner, pinned, loading }: Props) {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(TH, 'w-11 sm:w-20')}>
            <Eyebrow>Rank</Eyebrow>
          </TableHead>
          <TableHead className={TH}>
            <Eyebrow>Trader</Eyebrow>
          </TableHead>
          <TableHead
            className={cn(TH, 'w-[5.5rem] text-right sm:w-36')}
            aria-sort={sortAria(sort, 'volume')}
          >
            <Eyebrow className={sort === 'volume' ? 'text-rock/80' : undefined}>Volume</Eyebrow>
          </TableHead>
          <TableHead
            className={cn(TH, 'w-16 text-right sm:w-24')}
            aria-sort={sortAria(sort, 'trades')}
          >
            <Eyebrow className={sort === 'trades' ? 'text-rock/80' : undefined}>Trades</Eyebrow>
          </TableHead>
          <TableHead className={cn(TH, SPLIT, 'w-48 text-right')}>
            <Eyebrow>Maker / Taker</Eyebrow>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)
        ) : (
          <>
            {pinned && (
              <Row
                entry={pinned}
                sort={sort}
                isYou
                className="border-b-2 border-b-outline [&>td]:border-b-0"
              />
            )}
            {entries.map(e => (
              <Row key={e.owner} entry={e} sort={sort} isYou={e.owner === owner} />
            ))}
          </>
        )}
      </TableBody>
    </Table>
  );
}

function sortAria(sort: LeaderboardSort, col: LeaderboardSort) {
  return sort === col ? ('descending' as const) : undefined;
}

function Row({
  entry,
  sort,
  isYou,
  className,
}: {
  entry: LeaderboardEntry;
  sort: LeaderboardSort;
  isYou: boolean;
  className?: string;
}) {
  const podium = entry.rank <= 3;
  const share = makerShare(entry.maker_volume_usdc, entry.taker_volume_usdc);
  const makerPct = Math.round(share * 100);

  return (
    <TableRow
      aria-current={isYou ? 'true' : undefined}
      className={cn(
        isYou && 'bg-amber-200/[0.05] shadow-[inset_2px_0_0_var(--color-amber-200)]',
        isYou && 'hover:bg-amber-200/[0.07]',
        className
      )}
    >
      <TableCell className={cn(TD, 'font-mono text-xs tabular-nums')}>
        <span className={cn(podium ? 'text-amber-200' : 'text-rock/45')}>
          {podium && (
            <span aria-hidden className="mr-1 text-amber-200/60">
              ▲
            </span>
          )}
          {entry.rank}
        </span>
      </TableCell>
      <TableCell className={TD}>
        <div className="flex min-w-0 items-center gap-2.5">
          <AccountAvatar address={entry.owner} className="size-5" />
          <span className="truncate font-mono text-xs text-rock/85">{shortOwner(entry.owner)}</span>
          {isYou && (
            <span className="shrink-0 border border-amber-200/50 px-1 font-mono text-[9px] uppercase leading-[14px] tracking-wider text-amber-200">
              You
            </span>
          )}
        </div>
      </TableCell>
      <TableCell
        className={cn(
          TD,
          'text-right font-mono text-xs tabular-nums',
          sort === 'volume' ? 'text-rock' : 'text-rock/70'
        )}
        title={usd(entry.volume_usdc)}
      >
        {usdCompact(entry.volume_usdc)}
      </TableCell>
      <TableCell
        className={cn(
          TD,
          'text-right font-mono text-xs tabular-nums',
          sort === 'trades' ? 'text-rock' : 'text-rock/70'
        )}
      >
        {count(entry.trades)}
      </TableCell>
      <TableCell
        className={cn(TD, SPLIT)}
        title={`Maker ${usd(entry.maker_volume_usdc)} · Taker ${usd(entry.taker_volume_usdc)}`}
      >
        <div className="flex items-center justify-end gap-2.5">
          <div
            className="flex h-1 w-16 overflow-hidden bg-rock/15"
            role="img"
            aria-label={`${makerPct}% maker, ${100 - makerPct}% taker`}
          >
            <span className="h-full bg-lichen/70" style={{ width: `${makerPct}%` }} />
          </div>
          <span className="w-16 text-right font-mono text-[11px] tabular-nums text-rock/55">
            {makerPct}/{100 - makerPct}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function SkeletonRow() {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className={TD}>
        <Bone className="h-3 w-5" />
      </TableCell>
      <TableCell className={TD}>
        <div className="flex items-center gap-2.5">
          <Bone className="size-5" />
          <Bone className="h-3 w-20" />
        </div>
      </TableCell>
      <TableCell className={TD}>
        <Bone className="ml-auto h-3 w-16" />
      </TableCell>
      <TableCell className={TD}>
        <Bone className="ml-auto h-3 w-8" />
      </TableCell>
      <TableCell className={cn(TD, SPLIT)}>
        <Bone className="ml-auto h-3 w-28" />
      </TableCell>
    </TableRow>
  );
}
