import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { useAccessOwner } from '@/features/access-gate';

import {
  fetchLeaderboard,
  fetchLeaderboardRank,
  type LeaderboardEntry,
  type LeaderboardSort,
  type LeaderboardWindow,
} from '../api/leaderboardClient';
import { PAGE_SIZE } from './constants';

const STALE_MS = 60_000;

/** Don't hammer a 4xx (e.g. 404 before the endpoint ships); retry network/5xx once. */
function retry(failures: number, err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status && status >= 400 && status < 500) return false;
  }
  return failures < 1;
}

export function useLeaderboard(window: LeaderboardWindow, sort: LeaderboardSort) {
  const query = useInfiniteQuery({
    queryKey: ['leaderboard', window, sort],
    queryFn: ({ pageParam, signal }) =>
      fetchLeaderboard({ window, sort, limit: PAGE_SIZE, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.entries.length, 0);
      return last.entries.length === PAGE_SIZE && loaded < last.total_traders ? loaded : undefined;
    },
    staleTime: STALE_MS,
    retry,
  });

  const entries = useMemo<LeaderboardEntry[]>(() => {
    const seen = new Set<string>();
    const out: LeaderboardEntry[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const e of page.entries) {
        // Ranks can shift between page fetches; never render an owner twice.
        if (seen.has(e.owner)) continue;
        seen.add(e.owner);
        out.push(e);
      }
    }
    return out;
  }, [query.data]);

  const head = query.data?.pages[0];
  return { ...query, entries, summary: head };
}

/** The connected (access-gated) wallet's own rank in the current view. */
export function useMyRank(window: LeaderboardWindow, sort: LeaderboardSort) {
  const owner = useAccessOwner();
  const query = useQuery({
    queryKey: ['leaderboard-rank', owner, window, sort],
    queryFn: ({ signal }) => fetchLeaderboardRank(owner!, { window, sort }, signal),
    enabled: !!owner,
    staleTime: STALE_MS,
    retry,
  });
  return { owner, ...query };
}
