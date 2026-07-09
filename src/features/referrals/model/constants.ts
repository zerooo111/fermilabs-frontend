/**
 * Referral programme constants shared by the UI.
 *
 * The reward rate is the backend's source of truth (`REFERRAL_BPS = 2` in
 * `db.rs`); this label mirrors it for display copy. Keep them in sync if the
 * rate ever changes.
 */

/** 2 bps = 0.02%. Mirrors `db::REFERRAL_BPS`. */
export const REWARD_RATE_BPS = 2;
export const REWARD_RATE_LABEL = '0.02%';

/** Taker fee — 10 bps = 0.10%. Mirrors `db::TAKER_FEE_BPS`. Display copy only. */
export const TAKER_FEE_LABEL = '0.10%';

/**
 * Rebate: 10% of your own paid fees, returned to you — but only while you're
 * bound to a referral code. Mirrors `db::REBATE_BPS` (1 bp = 10% of the taker
 * fee). Keep the label in sync with the backend if the rate changes.
 */
export const REBATE_SHARE_LABEL = '10%';
export const REBATE_RATE_LABEL = '0.01%';

/** Max referral codes a wallet may mint (mirrors backend MAX_CODES_PER_WALLET). */
export const MAX_CODES_PER_WALLET = 1;

/** Max people a single referral code can refer (mirrors backend REFERRAL_INVITE_MAX_USES). */
export const MAX_REFERRALS_PER_CODE = 10;
