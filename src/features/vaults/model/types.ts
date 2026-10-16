/**
 * Vault domain types. The shapes are what the UI needs, not a mirror of any
 * backend payload yet. When the API lands, map its response into these.
 */

export type VaultKind = 'protocol' | 'community';

export type VaultStatus = 'open' | 'closed';

export type Side = 'long' | 'short';

/** One daily snapshot of the vault. */
export interface VaultPoint {
  /** Unix seconds, start of day UTC. */
  time: number;
  /** Account value in USDC. */
  value: number;
  /** Cumulative trading PnL in USDC since inception. */
  pnl: number;
  /** Price of one vault share in USDC. Starts at 1. */
  sharePrice: number;
}

export interface VaultPosition {
  market: string;
  side: Side;
  /** Size in base units. */
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
}

export interface VaultTrade {
  id: string;
  time: number;
  market: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  /** Realized PnL on a closing fill, null on an opening fill. */
  closedPnl: number | null;
}

export interface VaultDepositor {
  address: string;
  equity: number;
  allTimePnl: number;
  isLeader: boolean;
}

export interface UserVaultPosition {
  equity: number;
  allTimePnl: number;
  /** Unix seconds when the latest deposit unlocks. */
  unlocksAt: number;
}

export interface Vault {
  id: string;
  name: string;
  kind: VaultKind;
  status: VaultStatus;
  leader: string;
  description: string;
  /** Unix seconds. */
  createdAt: number;
  tvl: number;
  /** Annualized return over the last 30 days, fractional. */
  apr30d: number;
  /** Return since the vault opened, fractional. */
  allTimeReturn: number;
  /**
   * Internal accounting only, never shown. Deposits buy shares at this price,
   * so returns stay correct when money flows in or out.
   */
  sharePrice: number;
  /** Cut of depositor profits the vault manager keeps, fractional. */
  leaderFee: number;
  lockupDays: number;
  depositorCount: number;
  history: VaultPoint[];
  positions: VaultPosition[];
  trades: VaultTrade[];
  depositors: VaultDepositor[];
  user: UserVaultPosition | null;
}
