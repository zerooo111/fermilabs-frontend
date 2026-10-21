/**
 * REST client for /v2/points/* (ALIEN points). The reads are public and keyed
 * by address, so anyone can check any wallet. Claiming needs the wallet's
 * access-gate session token. Timestamps are unix ms.
 */
import axios from 'axios';
import { API_ROUTES_V2, config } from '@/shared/config/constants';

export type PointsCategory =
  | 'flp_vault'
  | 'resting_depth'
  | 'volume'
  | 'open_interest'
  | 'referral'
  | 'bonus'
  | 'quest';

/** Only `live` / `provisional` / `final` epochs count toward balances. */
export type EpochStatus = 'upcoming' | 'live' | 'computing' | 'provisional' | 'final';

/** The statuses the API counts toward balances. */
export type VisibleStatus = 'live' | 'provisional' | 'final';

/**
 * An entry's claim lifecycle: `granted` (earned, not claimable yet) →
 * `claimable` → `claimed`, or `expired`. Only `claimed` points count toward
 * totals and ranks.
 */
export type ClaimStatus = 'granted' | 'claimable' | 'claimed' | 'expired';

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
  /** `total`, `by_status` and `by_category` count every point that hasn't expired. */
  by_status: Record<VisibleStatus, number>;
  by_category: Record<PointsCategory, number>;
  /** Points in each claim status. */
  claims: Record<ClaimStatus, number>;
}

export interface PointsAccountEpoch {
  epoch: number;
  status: VisibleStatus;
  total: number;
  entries: number;
  by_category: Record<PointsCategory, number>;
  claims: Record<ClaimStatus, number>;
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
  claim_status: ClaimStatus;
}

export interface PointsActivity {
  entries: PointsEntry[];
  next_cursor: string | null;
}

export interface PointsLeaderboard {
  epoch: number | null;
  category: PointsCategory | null;
  /** An `external_id` prefix such as `bonus:mev`. */
  campaign: string | null;
  /** Ranked wallets on this board. */
  total: number;
  /**
   * `details` is the wallet's entry details on a campaign board, when it has
   * one entry there (an MEV victim's `{loss_usd, sandwiched_txs}`), else null.
   */
  rows: { rank: number; wallet: string; points: number; details: Record<string, unknown> | null }[];
  /**
   * The `wallet` param's place on the board. `position` is its 1-based row,
   * for paging to it; both are null when it isn't on the board.
   */
  me: { wallet: string; rank: number | null; position: number | null; points: number } | null;
}

const baseUrl = (): string => config.devnet.gatewayUrl;

const accountPath = (wallet: string) =>
  API_ROUTES_V2.points_account.replace('{wallet}', encodeURIComponent(wallet));

/**
 * The gateway lets browsers cache reads for 15 s. Right after a claim the page
 * needs the new numbers, so until this time reads add a throwaway `_` param to
 * skip that cache.
 */
let skipCacheUntil = 0;

export function skipReadCache(ms = 30_000) {
  skipCacheUntil = Date.now() + ms;
}

async function get<T>(path: string, params: object, signal?: AbortSignal): Promise<T> {
  const fresh = Date.now() < skipCacheUntil ? { _: Date.now() } : {};
  const res = await axios.get<T>(`${baseUrl()}${path}`, {
    params: { ...params, ...fresh },
    signal,
  });
  return res.data;
}

export function fetchPointsEpochs(signal?: AbortSignal) {
  return get<{ epochs: PointsEpoch[] }>(API_ROUTES_V2.points_epochs, {}, signal);
}

export function fetchPointsLeaderboard(
  params: {
    limit: number;
    offset?: number;
    epoch?: number;
    category?: PointsCategory;
    campaign?: string;
    wallet?: string;
  },
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

export interface PointsClaim {
  wallet: string;
  /** Entries claimed; 0 when nothing was claimable. */
  claimed: number;
  points: number;
}

/** Claims the token's wallet's claimable entries: all of them, or only `ids`. */
export async function claimPoints(token: string, ids?: number[]): Promise<PointsClaim> {
  const res = await axios.post<PointsClaim>(
    `${baseUrl()}${API_ROUTES_V2.points_claim}`,
    ids ? { ids } : null,
    { headers: { 'x-wallet-auth': token } }
  );
  return res.data;
}
