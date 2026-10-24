/**
 * REST client for FLP vaults on the gateway. The gateway syncs vault state
 * from chain into its database, so these reads never touch Solana RPC.
 *
 *   GET /v2/vaults?network=&window=&wallet=
 *   GET /v2/vaults/:network/:address?window=&wallet=
 *   GET /v2/vaults/:network/:address/{history,depositors,activity}
 *
 * Amounts are UI units (USDC, shares) and times are unix ms. Every vault
 * carries its `network`, and devnet and mainnet are never mixed in a total.
 */
import axios from 'axios';
import { API_ROUTES_V2 } from '@/shared/config/constants';

export type VaultNetwork = 'devnet' | 'mainnet';
export type VaultWindow = '7d' | '30d' | '90d' | 'all';
export type VaultKind = 'protocol' | 'community';
export type VaultMode = 'pre-deposit' | 'live' | 'unwind' | 'closed';

export interface VaultUser {
  wallet: string;
  shares: number;
  equity: number;
  cost_basis: number;
  total_deposited: number;
  total_withdrawn: number;
  /** Null when part of it is unknown (e.g. unrealized PnL the API can't price). */
  all_time_pnl: number | null;
  realized_pnl: number;
  pending_deposit: number;
  pending_withdraw_shares: number;
  /** Ready to claim now, in USDC terms (FLP vaults). */
  claimable?: number;
  first_deposit_at_ms: number | null;
  last_action_at_ms: number | null;
}

export interface Vault {
  /** Where the row came from: the gateway's synced copy, or the FLP data API. */
  source?: 'gateway' | 'flp';
  network: VaultNetwork;
  address: string;
  vault_id: number;
  program_id: string;
  group: string;
  name: string;
  description: string;
  kind: VaultKind;
  mode: VaultMode;
  deposits_open: boolean;
  withdrawals_open: boolean;
  /** Why Deposit / Withdraw are unavailable, when they are (FLP vaults). */
  deposits_reason?: string | null;
  withdrawals_reason?: string | null;
  breaker_tripped: boolean;
  leader: string;
  delegate: string;
  fermi_account: string;
  quote_mint: string;
  share_mint: string;
  quote_decimals: number;
  share_decimals: number;
  /** Null when the vault can't be valued right now. */
  tvl: number | null;
  share_price: number;
  high_water_mark: number;
  share_supply: number;
  net_deposits: number;
  total_deposited: number;
  total_withdrawn: number;
  pre_deposit_total: number;
  all_time_pnl: number | null;
  all_time_return: number;
  window: VaultWindow;
  /** Share-price return over the window; null without history. */
  window_return: number | null;
  /** Window return annualized; null until a day of history. */
  apr: number | null;
  depositors: number;
  tvl_cap: number;
  min_deposit: number;
  min_withdraw_shares: number;
  fees: {
    management_bps: number;
    performance_bps: number;
    deposit_bps: number;
    withdraw_bps: number;
  };
  epoch: number;
  epoch_duration_s: number;
  epoch_started_at_ms: number | null;
  /** When the open epoch settles queued requests (FLP vaults). */
  next_settlement_ms?: number | null;
  created_at_ms: number;
  live_started_at_ms: number | null;
  age_days: number;
  nav_slot: number;
  synced_at_ms: number;
  /** The gateway hasn't synced this vault for a while. */
  stale: boolean;
  /** List only: [time ms, share price]. */
  sparkline?: [number, number][];
  /** Present when a wallet was passed; null when it holds no position. */
  user?: VaultUser | null;
}

export interface VaultList {
  window: VaultWindow;
  network: VaultNetwork | 'all';
  updated_at_ms: number;
  totals: { network: VaultNetwork; vaults: number; tvl: number | null }[];
  total: number;
  vaults: Vault[];
}

export interface VaultHistoryPoint {
  t: number;
  tvl: number;
  share_price: number;
  /** Null on chain-derived points (net deposits at that time are unknown). */
  pnl: number | null;
  /** Share-price return since the window start. */
  return: number | null;
}

export interface VaultHistory {
  window: VaultWindow;
  bucket_s: number;
  points: VaultHistoryPoint[];
}

export interface VaultDepositors {
  total: number;
  depositors: VaultUser[];
}

export type VaultEventKind =
  | 'pre_deposit'
  | 'pre_withdraw'
  | 'deposit_requested'
  | 'deposit_cancelled'
  | 'deposit_claimed'
  | 'withdraw_requested'
  | 'withdraw_cancelled'
  | 'withdraw_claimed'
  | 'terminal_redeemed';

export interface VaultEvent {
  signature: string;
  event_index: number;
  slot: number;
  time_ms: number;
  kind: VaultEventKind;
  wallet: string | null;
  amount: number | null;
  shares: number | null;
  epoch: number | null;
}

export interface VaultActivity {
  events: VaultEvent[];
  next_before: number | null;
}

// The gateway's vault sync (/v2/vaults) isn't deployed anywhere yet, so it's
// only called when VITE_VAULTS_GATEWAY_URL points at one (e.g.
// https://v1.fermi.trade/staging). FLP vaults don't need it: they read the
// FLP data API (model/flpSource.ts).
const GATEWAY_URL: string | undefined = import.meta.env.VITE_VAULTS_GATEWAY_URL;
export const gatewayConfigured = !!GATEWAY_URL;
const GATEWAY = () => GATEWAY_URL;

const vaultPath = (network: VaultNetwork, address: string) =>
  API_ROUTES_V2.vault
    .replace('{network}', network)
    .replace('{address}', encodeURIComponent(address));

async function get<T>(path: string, params: object, signal?: AbortSignal): Promise<T> {
  const res = await axios.get<T>(`${GATEWAY()}${path}`, { params, signal });
  return res.data;
}

export function fetchVaults(
  params: { window: VaultWindow; wallet?: string; limit?: number },
  signal?: AbortSignal
) {
  return get<VaultList>(API_ROUTES_V2.vaults, { limit: 200, ...params }, signal);
}

export function fetchVault(
  network: VaultNetwork,
  address: string,
  params: { window: VaultWindow; wallet?: string },
  signal?: AbortSignal
) {
  return get<Vault>(vaultPath(network, address), params, signal);
}

export function fetchVaultHistory(
  network: VaultNetwork,
  address: string,
  window: VaultWindow,
  signal?: AbortSignal
) {
  return get<VaultHistory>(`${vaultPath(network, address)}/history`, { window }, signal);
}

export function fetchVaultDepositors(
  network: VaultNetwork,
  address: string,
  params: { limit: number; offset: number },
  signal?: AbortSignal
) {
  return get<VaultDepositors>(`${vaultPath(network, address)}/depositors`, params, signal);
}

export function fetchVaultActivity(
  network: VaultNetwork,
  address: string,
  params: { wallet?: string; before?: number; limit: number },
  signal?: AbortSignal
) {
  return get<VaultActivity>(`${vaultPath(network, address)}/activity`, params, signal);
}
