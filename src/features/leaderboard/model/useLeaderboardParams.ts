import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { LeaderboardSort, LeaderboardWindow } from '../api/leaderboardClient';
import { DEFAULT_SORT, DEFAULT_WINDOW, SORTS, WINDOWS } from './constants';

const isWindow = (v: string | null): v is LeaderboardWindow => WINDOWS.some(w => w.value === v);
const isSort = (v: string | null): v is LeaderboardSort => SORTS.some(s => s.value === v);

/** Window + sort, persisted in `?window=&sort=` (defaults are omitted from the URL). */
export function useLeaderboardParams() {
  const [params, setParams] = useSearchParams();
  const rawWindow = params.get('window');
  const rawSort = params.get('sort');
  const window = isWindow(rawWindow) ? rawWindow : DEFAULT_WINDOW;
  const sort = isSort(rawSort) ? rawSort : DEFAULT_SORT;

  const update = useCallback(
    (key: 'window' | 'sort', value: string, fallback: string) => {
      setParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (value === fallback) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const setWindow = useCallback(
    (v: LeaderboardWindow) => update('window', v, DEFAULT_WINDOW),
    [update]
  );
  const setSort = useCallback((v: LeaderboardSort) => update('sort', v, DEFAULT_SORT), [update]);

  return { window, sort, setWindow, setSort };
}
