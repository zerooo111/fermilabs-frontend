/**
 * Points queries. Balances move when an epoch is loaded or changes status
 * (weekly), and live estimates refresh a few times an hour, so a minute is
 * plenty.
 */
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import axios from 'axios';

import {
  fetchPointsAccount,
  fetchPointsActivity,
  fetchPointsEpochs,
  fetchPointsLeaderboard,
} from '../api/pointsClient';

const STALE_MS = 60_000;
export const ACTIVITY_PAGE = 25;

const pointsKey = ['points'] as const;

/** Don't hammer a 4xx (bad address, endpoint not deployed); retry network/5xx once. */
function retry(failures: number, err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status && status >= 400 && status < 500) return false;
  }
  return failures < 1;
}

export function usePointsEpochs() {
  return useQuery({
    queryKey: [...pointsKey, 'epochs'],
    queryFn: ({ signal }) => fetchPointsEpochs(signal),
    select: data => data.epochs,
    staleTime: STALE_MS,
    retry,
  });
}

export function usePointsLeaderboard(limit: number) {
  return useQuery({
    queryKey: [...pointsKey, 'leaderboard', limit],
    queryFn: ({ signal }) => fetchPointsLeaderboard({ limit }, signal),
    staleTime: STALE_MS,
    retry,
  });
}

export function usePointsAccount(wallet: string | undefined) {
  return useQuery({
    queryKey: [...pointsKey, 'account', wallet],
    queryFn: ({ signal }) => fetchPointsAccount(wallet!, signal),
    enabled: !!wallet,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    retry,
  });
}

export function usePointsActivity(wallet: string | undefined) {
  return useInfiniteQuery({
    queryKey: [...pointsKey, 'activity', wallet],
    queryFn: ({ pageParam, signal }) =>
      fetchPointsActivity(wallet!, { limit: ACTIVITY_PAGE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.next_cursor ?? undefined,
    enabled: !!wallet,
    staleTime: STALE_MS,
    retry,
  });
}
