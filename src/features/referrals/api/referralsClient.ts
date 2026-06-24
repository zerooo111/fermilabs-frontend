/**
 * REST client for /v1/referrals/* endpoints.
 *
 * Every call is authenticated with the access-gate session token via the
 * `X-Wallet-Auth` header — the same HMAC token used by the self-serve API-keys
 * flow (see `features/api-keys/api/keysClient.ts`). The backend gate is the
 * source of truth: a stale/expired token fails closed with 401, a
 * non-whitelisted wallet with 403. Errors arrive as `{ error: '<code>' }`; we
 * surface the raw code so the UI can map it to friendly copy.
 *
 * All money fields are returned twice by the backend: an integer native
 * quote-lots value (`*_reward` / `claimable` / `amount`) for exactness, plus a
 * convenience `*_usdc` float for display. The UI reads the `_usdc` views.
 */
import axios, { AxiosError } from 'axios';
import { config } from '@/shared/config/constants';

const baseUrl = (): string => config.devnet.gatewayUrl;

/** The caller's own binding as a referee (the code it redeemed). */
export interface ReferralBinding {
  code: string;
  referrer_wallet: string;
  bound_at: string;
}

/** Summary for the connected wallet acting as a referrer. GET /v1/referrals/me. */
export interface ReferralMe {
  codes: string[];
  referee_count: number;
  /** Native quote-lots (exact). */
  lifetime_reward: number;
  claimable: number;
  /** Live estimate for the current open epoch — not yet claimable. */
  pending: number;
  /** USDC views (display only). */
  lifetime_reward_usdc: number;
  claimable_usdc: number;
  pending_usdc: number;
  min_claim_usdc: number;
  /** This wallet's own referrer binding, or null if it never applied a code. */
  referred_by: ReferralBinding | null;
  /** ISO timestamp when `pending` seals into claimable (start of next bucket). */
  next_seal_at: string;
  /** Accrual epoch granularity: "hour" | "day". */
  accrual_bucket: string;
}

/** One referred wallet. GET /v1/referrals/referees. */
export interface RefereeView {
  referee_wallet: string;
  bound_at: string;
  accrued_volume: number;
  accrued_reward: number;
  accrued_reward_usdc: number;
}

/** POST /v1/referrals/codes. */
export interface CreatedCode {
  code: string;
}

/** POST /v1/referrals/bind. */
export interface BindResult {
  ok: boolean;
  referrer_wallet: string;
}

/** POST /v1/referrals/claim. */
export interface ClaimResult {
  claim_id: number;
  amount: number;
  amount_usdc: number;
}

export class ReferralsError extends Error {
  constructor(
    public code: string,
    public httpStatus?: number
  ) {
    super(code);
    this.name = 'ReferralsError';
  }
}

function unwrapError(e: unknown): never {
  if (axios.isAxiosError(e)) {
    const ax = e as AxiosError<{ error?: string }>;
    const code = ax.response?.data?.error || 'network_error';
    throw new ReferralsError(code, ax.response?.status);
  }
  throw new ReferralsError('unknown_error');
}

function authHeaders(token: string): Record<string, string> {
  return { 'X-Wallet-Auth': token };
}

export async function getMe(token: string): Promise<ReferralMe> {
  try {
    const res = await axios.get<ReferralMe>(`${baseUrl()}/v1/referrals/me`, {
      headers: authHeaders(token),
    });
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

export async function listReferees(token: string, limit = 50, offset = 0): Promise<RefereeView[]> {
  try {
    const res = await axios.get<RefereeView[]>(`${baseUrl()}/v1/referrals/referees`, {
      headers: authHeaders(token),
      params: { limit, offset },
    });
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

/** Mint a code. `code` is optional — omit it for a random one. */
export async function createCode(token: string, code?: string): Promise<CreatedCode> {
  try {
    const res = await axios.post<CreatedCode>(
      `${baseUrl()}/v1/referrals/codes`,
      code ? { code } : {},
      { headers: authHeaders(token) }
    );
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

/** Attach a referrer's code to the connected wallet (one-shot, immutable). */
export async function bindCode(token: string, code: string): Promise<BindResult> {
  try {
    const res = await axios.post<BindResult>(
      `${baseUrl()}/v1/referrals/bind`,
      { code },
      { headers: authHeaders(token) }
    );
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

/** Request a payout of the full claimable balance (must be ≥ the min threshold). */
export async function claimRewards(token: string): Promise<ClaimResult> {
  try {
    const res = await axios.post<ClaimResult>(
      `${baseUrl()}/v1/referrals/claim`,
      {},
      { headers: authHeaders(token) }
    );
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}
