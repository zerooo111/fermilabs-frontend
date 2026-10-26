/**
 * FLP vaults read straight from the FLP data API, in the shape the vaults
 * pages already draw. The gateway's synced copy doesn't cover the RC4
 * deployment yet, so the configured FLP vaults come from here and any vault
 * the gateway also lists is replaced by this fresher read.
 *
 * This is the only place FLP's exact bigint amounts become display numbers.
 * A value the API can't give stays `null` (shown as a dash), never 0.
 */
import {
  FLP_CLUSTER,
  FLP_PROGRAM_ID,
  PRICE_DECIMALS,
  availability,
  flpVaultConfig,
  vaultView,
  type FlpEnvelope,
  type FlpVaultConfig,
} from '@/features/flp-vault';

import type { Vault, VaultNetwork, VaultUser, VaultWindow } from '../api/vaultsClient';

const DESCRIPTION =
  'Fermi’s protocol vault. It makes markets on Fermi perps and earns the spread and trading fees for depositors. This is the devnet test deployment, using synthetic USDC.';

/** Native units to a display number. Display only: never fed back into a transaction. */
const ui = (native: bigint | string, decimals: number) => Number(BigInt(native)) / 10 ** decimals;

/**
 * `wallet` is the connected wallet, if any. The envelope's user is attached
 * only when it was read for that wallet; a copy kept from another wallet (or
 * from before connecting) leaves `user` undefined, which reads as loading.
 */
export function flpToVault(
  config: FlpVaultConfig,
  env: FlpEnvelope,
  window: VaultWindow,
  wallet: string | undefined
): Vault {
  const d = env.data;
  const v = vaultView(env);
  const qd = v.quoteDecimals;
  const sd = v.shareDecimals;
  const l = d.lifecycle;
  const tvl = v.tvl === null ? null : ui(v.tvl, qd);
  const sharePrice = Number(v.price) / 10 ** PRICE_DECIMALS;
  // With the deposits waiting in escrow, as TVL has them (vaultView.netIn).
  const netDeposits = ui(v.netIn, qd);
  const createdMs = Number(d.flows.inceptionTs) * 1000;
  const liveMs = Number(l.graduation.liveStartedAt) * 1000;
  const p = d.configuration.params;
  const mine = wallet !== undefined && env.owner === wallet;
  const user = mine ? env.data.user : undefined;
  const shares = BigInt(user?.sharesHeld ?? '0');
  const open = availability(env, user, shares);

  return {
    source: 'flp',
    network: FLP_CLUSTER,
    address: config.address.toBase58(),
    vault_id: config.id,
    program_id: FLP_PROGRAM_ID.toBase58(),
    group: d.addresses.group,
    name: config.name,
    description: DESCRIPTION,
    kind: 'protocol',
    mode: l.mode,
    deposits_open: open.canDeposit,
    withdrawals_open: open.canWithdraw,
    deposits_reason: open.depositReason,
    withdrawals_reason: open.withdrawReason,
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
    all_time_pnl: tvl === null ? null : tvl - netDeposits,
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
    next_settlement_ms: v.epoch.scheduledEnd * 1000,
    created_at_ms: createdMs,
    live_started_at_ms: liveMs > 0 ? liveMs : null,
    age_days: Math.max(0, Math.floor((Date.now() - createdMs) / 86_400_000)),
    nav_slot: Number(d.valuation.lastProgramNav.slot),
    synced_at_ms: env.generated_ts_ms,
    stale: !!env.cache?.stale && Date.now() - env.generated_ts_ms > 60_000,
    user: wallet === undefined || !mine ? undefined : flpUser(env, sharePrice),
  };
}

function flpUser(env: FlpEnvelope, sharePrice: number): VaultUser | null {
  const u = env.data.user;
  if (!u) return null;
  const { quoteDecimals: qd, shareDecimals: sd } = env.data.units;
  const dep = u.deposit;
  const wd = u.withdrawal;
  const invested = ui(u.investedSharesIncludingOwedAndUnfunded, sd);
  const principal = ui(u.refundablePublicPrincipal, qd);
  const pendingDeposit = dep.state === 'queued' ? ui(dep.ticket.amount, qd) : 0;
  const unrealized = u.pnl.currentUnrealized;
  // The API's own valuation of the invested position when it has one; the
  // last-close share price otherwise.
  const investedValue =
    unrealized.value !== null
      ? ui(unrealized.indicativeInvestedValueQuote, qd)
      : invested * sharePrice;
  // Ready to claim, in USDC terms: settled deposit shares, refunds, funded withdrawals.
  const claimable =
    (dep.state === 'claimable-shares' ? ui(dep.claimable, sd) * sharePrice : 0) +
    (dep.state === 'refund-only' ? ui(dep.claimable, qd) : 0) +
    (wd.state === 'funded-claimable' ? ui(wd.claimable, qd) : 0) +
    ui(u.graduationClaimableShares, sd) * sharePrice;
  const realized = ui(u.pnl.recordedRealizedQuote, qd);
  const equity = investedValue + principal + claimable;
  const hasTicket = dep.state !== 'none' || wd.state !== 'none';
  if (equity === 0 && !hasTicket) return null;
  return {
    wallet: u.owner,
    shares: invested,
    equity,
    cost_basis: ui(u.pnl.heldSharesCostBasisQuote, qd) + principal,
    total_deposited: ui(u.pnl.totalDepositedRecorded, qd),
    total_withdrawn: ui(u.pnl.totalWithdrawnRecorded, qd),
    all_time_pnl: unrealized.value === null ? null : realized + ui(unrealized.value, qd),
    realized_pnl: realized,
    pending_deposit: pendingDeposit,
    pending_withdraw_shares:
      wd.state === 'queued' || wd.state === 'deferred' ? ui(wd.ticket.amount, sd) : 0,
    claimable,
    first_deposit_at_ms: null,
    last_action_at_ms: null,
  };
}

/** The FLP vault config for a vault route, if it's one of ours. */
export function isFlpVault(network: VaultNetwork, address: string) {
  return network === FLP_CLUSTER ? flpVaultConfig(address) : undefined;
}
