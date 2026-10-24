/**
 * FLP vaults read straight from the FLP data API, in the shape the vaults
 * pages already draw. The gateway's synced copy doesn't cover the RC4
 * deployment yet, so the configured FLP vaults come from here and any vault
 * the gateway also lists is replaced by this fresher read.
 */
import {
  FLP_PROGRAM_ID,
  FLP_VAULTS,
  vaultView,
  type FlpEnvelope,
  type FlpVaultConfig,
} from '@/features/flp-vault';

import type { Vault, VaultUser, VaultWindow } from '../api/vaultsClient';

const DESCRIPTION =
  'Fermi’s protocol vault. It makes markets on Fermi perps and earns the spread and trading fees for depositors. This is the devnet test deployment, using synthetic USDC.';

/** Native units to a display number. Display only: never fed back into a transaction. */
const ui = (native: bigint | string, decimals: number) => Number(BigInt(native)) / 10 ** decimals;

export function flpToVault(config: FlpVaultConfig, env: FlpEnvelope, window: VaultWindow): Vault {
  const d = env.data;
  const v = vaultView(env);
  const qd = v.quoteDecimals;
  const sd = v.shareDecimals;
  const l = d.lifecycle;
  const tvl = ui(v.tvl ?? v.escrow, qd);
  const sharePrice = Number(v.price) / 1e6;
  const netDeposits = ui(d.flows.netDeposits, qd);
  const createdMs = Number(d.flows.inceptionTs) * 1000;
  const liveMs = Number(l.graduation.liveStartedAt) * 1000;
  const p = d.configuration.params;

  return {
    source: 'flp',
    network: 'devnet',
    address: config.address.toBase58(),
    vault_id: config.id,
    program_id: FLP_PROGRAM_ID.toBase58(),
    group: d.addresses.group,
    name: config.name,
    description: DESCRIPTION,
    kind: 'protocol',
    mode: l.mode,
    deposits_open:
      !l.depositsPaused &&
      !l.publicDepositsPaused &&
      !l.breaker &&
      (l.mode === 'pre-deposit' || l.mode === 'live'),
    withdrawals_open: !l.withdrawalsPaused || l.mode === 'pre-deposit',
    breaker_tripped: l.breaker,
    leader: d.configuration.delegate,
    delegate: d.configuration.delegate,
    fermi_account: d.addresses.fermiAccount,
    quote_mint: d.units.quoteMint,
    share_mint: d.units.shareMint,
    quote_decimals: qd,
    share_decimals: sd,
    tvl,
    share_price: sharePrice,
    high_water_mark: Number(BigInt(d.fees.highWaterMarkPriceE12)) / 1e12,
    share_supply: ui(v.supply, sd),
    net_deposits: netDeposits,
    total_deposited: ui(d.flows.totalDepositedGross, qd),
    total_withdrawn: ui(d.flows.totalWithdrawnNet, qd),
    pre_deposit_total: ui(d.valuation.segregated.publicRefundablePrincipal, qd),
    // Value now less what went in: the vault's lifetime result, fees included.
    all_time_pnl: tvl - netDeposits,
    all_time_return: sharePrice - 1,
    window,
    // Returns need share-price history, which the data API doesn't index yet.
    window_return: null,
    apr: null,
    depositors: d.flows.activeDepositors,
    tvl_cap: ui(p.tvlCap, qd),
    min_deposit: ui(p.minDeposit, qd),
    min_withdraw_shares: ui(p.minWithdrawShares, sd),
    fees: {
      management_bps: p.mgmtFeeBps,
      performance_bps: p.perfFeeBps,
      deposit_bps: p.depositFeeBps,
      withdraw_bps: p.withdrawFeeBps,
    },
    epoch: Number(v.epoch.current),
    epoch_duration_s: p.epochDurationS,
    epoch_started_at_ms: Number(d.epoch.startedAt) * 1000,
    created_at_ms: createdMs,
    live_started_at_ms: liveMs > 0 ? liveMs : null,
    age_days: Math.max(0, Math.floor((Date.now() - createdMs) / 86_400_000)),
    nav_slot: Number(d.valuation.lastProgramNav.slot),
    synced_at_ms: env.generated_ts_ms,
    stale: !!env.cache?.stale && Date.now() - env.generated_ts_ms > 60_000,
    user: env.owner ? flpUser(env, sharePrice) : undefined,
  };
}

function flpUser(env: FlpEnvelope, sharePrice: number): VaultUser | null {
  const u = env.data.user;
  if (!u) return null;
  const { quoteDecimals: qd, shareDecimals: sd } = env.data.units;
  const shares = ui(u.investedSharesIncludingOwedAndUnfunded, sd);
  const principal = ui(u.refundablePublicPrincipal, qd);
  const pendingDeposit = u.deposit.state === 'queued' ? ui(u.deposit.ticket.amount, qd) : 0;
  const unrealized =
    u.pnl.currentUnrealized.value !== null ? ui(u.pnl.currentUnrealized.value, qd) : 0;
  const realized = ui(u.pnl.recordedRealizedQuote, qd);
  const equity = shares * sharePrice + principal;
  if (equity === 0 && pendingDeposit === 0 && u.withdrawal.state === 'none') return null;
  return {
    wallet: u.owner,
    shares,
    equity,
    cost_basis: ui(u.pnl.heldSharesCostBasisQuote, qd) + principal,
    total_deposited: ui(u.pnl.totalDepositedRecorded, qd),
    total_withdrawn: ui(u.pnl.totalWithdrawnRecorded, qd),
    all_time_pnl: realized + unrealized,
    realized_pnl: realized,
    pending_deposit: pendingDeposit,
    pending_withdraw_shares:
      u.withdrawal.state === 'queued' || u.withdrawal.state === 'deferred'
        ? ui(u.withdrawal.ticket.amount, sd)
        : 0,
    first_deposit_at_ms: null,
    last_action_at_ms: null,
  };
}

export function isFlpVault(network: string, address: string): FlpVaultConfig | undefined {
  return network === 'devnet' ? FLP_VAULTS.find(v => v.address.toBase58() === address) : undefined;
}
