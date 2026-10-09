/**
 * Leaderboard feature root: summary tiles, window/sort controls (persisted in
 * the URL), and the paged trader table with its loading/empty/error states.
 */
import axios from 'axios';
import { Trophy } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Segmented } from '@/shared/ui/segmented';
import { TabStrip, TabStripItem } from '@/shared/ui/tab-strip';

import type { LeaderboardSort } from '../api/leaderboardClient';
import { SORTS, WINDOWS, WINDOW_PHRASE } from '../model/constants';
import { count, relativeTime, windowSince } from '../model/format';
import { useLeaderboard, useMyRank } from '../model/useLeaderboard';
import { useLeaderboardParams } from '../model/useLeaderboardParams';
import { LeaderboardTable } from './LeaderboardTable';
import { Eyebrow } from './primitives';
import { SummaryTiles } from './SummaryTiles';

const WINDOW_OPTIONS = WINDOWS.map(w => ({
  value: w.value,
  title: w.title,
  label: (
    <>
      <span className="sm:hidden">{w.short}</span>
      <span className="hidden sm:inline">{w.label}</span>
    </>
  ),
}));

export function Leaderboard() {
  const { window, sort, setWindow, setSort } = useLeaderboardParams();
  const board = useLeaderboard(window, sort);
  const mine = useMyRank(window, sort);

  const { entries, summary } = board;
  const myEntry = mine.data?.entry ?? null;
  const pinned = myEntry && !entries.some(e => e.owner === myEntry.owner) ? myEntry : null;
  const updated = relativeTime(summary?.updated_at_ms);
  const since = window === 'all' ? 'All time' : windowSince(summary?.window_start_ms);

  return (
    <div className="space-y-5">
      <SummaryTiles
        window={window}
        totalVolume={summary?.total_volume_usdc}
        totalTraders={summary?.total_traders}
        loading={board.isPending}
        failed={board.isError}
        owner={mine.owner}
        rank={mine.data}
        rankLoading={mine.isPending}
        rankFailed={mine.isError}
      />

      <section className="flex flex-col border border-outline">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-outline bg-card px-3 py-1.5 sm:px-4">
          <TabStrip id="leaderboard-sort" active={sort} className="-mb-1.5 flex" role="tablist">
            {SORTS.map(s => (
              <TabStripItem
                key={s.value}
                value={s.value}
                onSelect={v => setSort(v as LeaderboardSort)}
                className="h-9"
                aria-controls="leaderboard-table"
              >
                {s.label}
              </TabStripItem>
            ))}
          </TabStrip>
          {/* The window control scrolls within itself on very narrow screens, never the page. */}
          <div className="-mx-1 max-w-full overflow-x-auto px-1 py-0.5">
            <Segmented
              aria-label="Time window"
              mono
              value={window}
              onChange={setWindow}
              options={WINDOW_OPTIONS}
              className="w-max"
            />
          </div>
        </div>

        {!board.isError && (since || updated) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-outline px-3 py-2 font-mono text-[11px] text-rock/45 sm:px-4">
            {since && <span>{since}</span>}
            {updated && <span className="sm:ml-auto">Updated {updated}</span>}
          </div>
        )}

        <div id="leaderboard-table" aria-busy={board.isFetching}>
          {board.isError ? (
            <ErrorState
              error={board.error}
              onRetry={() => {
                board.refetch();
                if (mine.owner) mine.refetch();
              }}
            />
          ) : !board.isPending && entries.length === 0 && !pinned ? (
            <EmptyState phrase={WINDOW_PHRASE[window]} />
          ) : (
            <LeaderboardTable
              entries={entries}
              sort={sort}
              owner={mine.owner}
              pinned={pinned}
              loading={board.isPending}
            />
          )}
        </div>

        {!board.isPending && !board.isError && entries.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
            <Eyebrow className="tabular-nums">
              {count(entries.length)} of {count(summary?.total_traders)}
            </Eyebrow>
            {board.isFetchNextPageError && (
              <span className="ml-auto text-xs text-danger">Couldn&apos;t load more.</span>
            )}
            {board.hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => board.fetchNextPage()}
                disabled={board.isFetchingNextPage}
              >
                {board.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ phrase }: { phrase: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <Trophy className="size-5 text-rock/30" aria-hidden />
      <p className="text-sm text-rock/75">No trades {phrase}</p>
      <p className="text-xs text-rock/45">Try a longer window, or place a trade to take #1.</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const notLive = status === 404;
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <p className="text-sm text-rock/75">
        {notLive ? 'The leaderboard isn’t live yet' : 'Couldn’t load the leaderboard'}
      </p>
      <p className="text-xs text-rock/45">
        {notLive
          ? 'Rankings will appear here once the service is deployed.'
          : 'Check your connection and try again.'}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
