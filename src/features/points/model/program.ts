/**
 * What the points page tells people about earning: each category in plain
 * words, when it starts, and where to go to do it. Dates and pools come from
 * the Season 1 rules (src/pages/points/docs/alien-points.md).
 */
import type { PointsCategory } from '../api/pointsClient';

/** Season 1, epoch 1: every category starts earning here. */
export const SEASON_START_MS = Date.UTC(2026, 10, 1);

/**
 * When the FLP vault opens for points. The rules put the pre-deposit period at
 * 20 Oct, but the vault isn't live yet (19 Oct 2026), so it counts down to the
 * season start like the rest. Set the launch date here once there is one.
 */
export const FLP_OPENS_MS = SEASON_START_MS;

export interface EarnWay {
  category: PointsCategory;
  /** What to do, in the user's words. */
  action: string;
  /** Why it pays, one line. */
  pitch: string;
  startsAtMs: number;
  /** App route; open it with appHref. */
  href: string;
  cta: string;
}

export const EARN_WAYS: EarnWay[] = [
  {
    category: 'flp_vault',
    action: 'Deposit in the FLP vault',
    pitch: 'Early depositors split a 250,000-point pool.',
    startsAtMs: FLP_OPENS_MS,
    href: '/flp',
    cta: 'Deposit',
  },
  {
    category: 'volume',
    action: 'Trade perps',
    pitch: 'Early volume earns the most points per dollar.',
    startsAtMs: SEASON_START_MS,
    href: '/perps',
    cta: 'Trade',
  },
  {
    category: 'resting_depth',
    action: 'Keep orders on the book',
    pitch: 'Two-sided limit orders near the mid price share the liquidity pool.',
    startsAtMs: SEASON_START_MS,
    href: '/perps',
    cta: 'Place orders',
  },
  {
    category: 'open_interest',
    action: 'Hold a position',
    pitch: 'Open positions earn every hour they stay open.',
    startsAtMs: SEASON_START_MS,
    href: '/perps',
    cta: 'Open a position',
  },
  {
    category: 'referral',
    action: 'Bring a friend',
    pitch: 'You earn a share of the points of every trader you refer.',
    startsAtMs: SEASON_START_MS,
    href: '/referrals',
    cta: 'Get your link',
  },
];
