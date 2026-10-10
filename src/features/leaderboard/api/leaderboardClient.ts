/**
 * REST client for the public perps leaderboard on the gateway.
 *
 *   GET /v2/leaderboard?window=&sort=&limit=&offset=
 *   GET /v2/leaderboard/rank/:owner?window=&sort=
 *
 * Public reads — no auth header. Money fields arrive as USDC decimal strings;
 * they're parsed for display only in `model/format.ts`.
 */
import axios from 'axios';
import { API_ROUTES_V2 } from '@/shared/config/constants';

/** Rolling (`24h`/`7d`/`30d`), calendar UTC (`week` from Mon 00:00, `month`), or `all`. */
export type LeaderboardWindow = '24h' | '7d' | '30d' | 'week' | 'month' | 'all';
export type LeaderboardSort = 'volume' | 'trades';

export interface LeaderboardEntry {
  rank: number;
  owner: string;
  volume_usdc: string;
  trades: number;
  maker_volume_usdc: string;
  taker_volume_usdc: string;
}

export interface LeaderboardPage {
  window: LeaderboardWindow;
  sort: LeaderboardSort;
  /** Start of the window (ms, UTC); null for `all`. */
  window_start_ms: number | null;
  updated_at_ms: number;
  total_traders: number;
  total_volume_usdc: string;
  entries: LeaderboardEntry[];
}

export interface LeaderboardRank {
  window: LeaderboardWindow;
  sort: LeaderboardSort;
  owner: string;
  total_traders: number;
  entry: LeaderboardEntry | null;
}

// The leaderboard endpoints are only deployed on the staging gateway for now,
// so they're read from there regardless of VITE_GATEWAY_URL. Drop this override
// (fall back to `config.devnet.gatewayUrl`) once the gateway ships to prod.
const STAGING_GATEWAY_URL = 'https://v1.fermi.trade/staging';
const GATEWAY = () => import.meta.env.VITE_LEADERBOARD_GATEWAY_URL || STAGING_GATEWAY_URL;

export async function fetchLeaderboard(
  params: { window: LeaderboardWindow; sort: LeaderboardSort; limit: number; offset: number },
  signal?: AbortSignal
): Promise<LeaderboardPage> {
  const res = await axios.get<LeaderboardPage>(`${GATEWAY()}${API_ROUTES_V2.leaderboard}`, {
    params,
    signal,
  });
  return res.data;
}

export async function fetchLeaderboardRank(
  owner: string,
  params: { window: LeaderboardWindow; sort: LeaderboardSort },
  signal?: AbortSignal
): Promise<LeaderboardRank> {
  const path = API_ROUTES_V2.leaderboard_rank.replace('{owner}', encodeURIComponent(owner));
  const res = await axios.get<LeaderboardRank>(`${GATEWAY()}${path}`, { params, signal });
  return res.data;
}
