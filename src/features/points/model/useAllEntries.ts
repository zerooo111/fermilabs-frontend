import { useEffect } from 'react';
import type { usePointsActivity } from './usePoints';

/** Every entry of a wallet's activity, paging through it in the background. */
export function useAllEntries(activity: ReturnType<typeof usePointsActivity>) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = activity;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return activity.data?.pages.flatMap(p => p.entries) ?? [];
}
