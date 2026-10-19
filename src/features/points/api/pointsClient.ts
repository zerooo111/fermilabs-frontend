/**
 * REST client for /v2/points/* (ALIEN points). Every route is public and
 * keyed by address, so anyone can check any wallet. Timestamps are unix ms.
 */
import axios from 'axios';
import { API_ROUTES_V2 } from '@/shared/config/constants';

export type PointsCategory =
  | 'flp_vault'
  | 'resting_depth'
  | 'volume'
  | 'open_interest'
  | 'referral'
  | 'bonus';

/** Only `live` / `provisional` / `final` epochs count toward balances. */
export type EpochStatus = 'upcoming' | 'live' | 'computing' | 'provisional' | 'final';

/** The statuses the API counts toward balances. */
export type VisibleStatus = 'live' | 'provisional' | 'final';

export interface PointsEpoch {
  epoch: number;
  season: number;
  name: string | null;
  starts_at_ms: number;
  ends_at_ms: number;
  status: EpochStatus;
  merkle_root: string | null;
}

export interface PointsAccount {
  wallet: string;
  total: number;
  /** `null` until the wallet has points. */
  rank: number | null;
  /** Wallets with a positive total. */
  ranked: number;
  by_status: Record<VisibleStatus, number>;
  by_category: Record<PointsCategory, number>;
}

export interface PointsAccountEpoch {
  epoch: number;
  status: VisibleStatus;
  total: number;
  entries: number;
  by_category: Record<PointsCategory, number>;
}

export interface PointsEntry {
  id: number;
  epoch: number;
  status: VisibleStatus;
  wallet: string;
  category: PointsCategory;
  /** Negative for removals. */
  points: number;
  market: string | null;
  description: string | null;
  reason: string | null;
  details: Record<string, unknown>;
  occurred_at_ms: number;
}

export interface PointsActivity {
  entries: PointsEntry[];
  next_cursor: string | null;
}

export interface PointsLeaderboard {
  epoch: number | null;
  category: PointsCategory | null;
  total: number;
  rows: { rank: number; wallet: string; points: number }[];
}

// Points are only deployed on the staging gateway for now, so they're read
// from there regardless of VITE_GATEWAY_URL. Drop this override once the
// gateway ships to prod.
const STAGING_GATEWAY_URL = 'https://v1.fermi.trade/staging';
const GATEWAY = () => import.meta.env.VITE_POINTS_GATEWAY_URL || STAGING_GATEWAY_URL;

const accountPath = (wallet: string) =>
  API_ROUTES_V2.points_account.replace('{wallet}', encodeURIComponent(wallet));

async function get<T>(path: string, params: object, signal?: AbortSignal): Promise<T> {
  const res = await axios.get<T>(`${GATEWAY()}${path}`, { params, signal });
  return res.data;
}

export function fetchPointsEpochs(signal?: AbortSignal) {
  return get<{ epochs: PointsEpoch[] }>(API_ROUTES_V2.points_epochs, {}, signal);
}

export function fetchPointsLeaderboard(
  params: { limit: number; offset?: number; epoch?: number; category?: PointsCategory },
  signal?: AbortSignal
) {
  return get<PointsLeaderboard>(API_ROUTES_V2.points_leaderboard, params, signal);
}

export function fetchPointsAccount(wallet: string, signal?: AbortSignal) {
  return get<PointsAccount>(accountPath(wallet), {}, signal);
}

export function fetchPointsAccountEpochs(wallet: string, signal?: AbortSignal) {
  return get<{ wallet: string; epochs: PointsAccountEpoch[] }>(
    `${accountPath(wallet)}/epochs`,
    {},
    signal
  );
}

export function fetchPointsActivity(
  wallet: string,
  params: { limit: number; cursor?: string },
  signal?: AbortSignal
) {
  return get<PointsActivity>(`${accountPath(wallet)}/activity`, params, signal);
}
