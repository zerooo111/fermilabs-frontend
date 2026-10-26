/**
 * Values the page derives from one data API response: totals, the reference
 * share price, epoch timing, and which deposit and withdrawal routes the
 * wallet has (frontend-guide.md B.2 rules 13 and 19, B.3).
 */
import type { FlpEnvelope, FlpPortfolio, FlpTicket, FlpUser, Unknown } from './api';
import { fixedScaled, fixedToNative, sharePrice } from './format';

export type DepositRoute = 'pre-deposit' | 'queued' | 'direct';
export type WithdrawRoute = 'refund' | 'instant' | 'queued' | 'redeem';

export function portfolioOf(env: FlpEnvelope): FlpPortfolio | null {
  const p = env.data.portfolio;
  return p && 'positions' in p ? p : null;
}
export function portfolioUnavailable(env: FlpEnvelope): string | null {
  const p = env.data.portfolio;
  if (!p) return 'Portfolio not available';
  return 'positions' in p ? null : (p as Unknown).reason;
}

export function vaultView(env: FlpEnvelope) {
  const d = env.data;
  const seg = d.valuation.segregated;
  const nav = d.valuation.currentNav.value ? fixedToNative(d.valuation.currentNav.value) : null;
  const escrow = BigInt(seg.depositEscrowBalance);
  const supply = BigInt(d.shares.pricingSupply);
  const last = d.valuation.lastProgramNav;
  const lastNavMid = BigInt(last.navMid);
  const params = d.configuration.params;
  return {
    mode: d.lifecycle.mode,
    quoteDecimals: d.units.quoteDecimals,
    shareDecimals: d.units.shareDecimals,
    /** Indicative trading NAV; null when the portfolio read failed. */
    nav,
    escrow,
    /** Trading NAV plus the deposit escrow (public principal and queued deposits). */
    tvl: nav === null ? null : nav + escrow,
    tvlCap: BigInt(params.tvlCap),
    supply,
    /** Quote per share at the last keeper close (NAV_mid), scaled by 1e6. */
    price: sharePrice(lastNavMid, supply),
    /** Immediate entry prices at NAV_high, immediate exit at NAV_low (same evidence). */
    priceHigh: sharePrice(BigInt(last.navHigh), supply),
    priceLow: sharePrice(BigInt(last.navLow), supply),
    priceSlot: last.slot,
    priceStale: last.stale,
    funding: fundingEvidence(env),
    minDeposit: BigInt(params.minDeposit),
    minWithdrawShares: BigInt(params.minWithdrawShares),
    params,
    epoch: {
      current: BigInt(d.epoch.current),
      requestTarget: BigInt(d.epoch.requestTarget),
      scheduledEnd: Number(d.epoch.scheduledEnd),
      cutoffAt: Number(d.epoch.cutoffAt),
      duration: params.epochDurationS,
    },
    unsettledPnl: d.pnl.unsettledTradingQuoteNative
      ? fixedToNative(d.pnl.unsettledTradingQuoteNative)
      : null,
  };
}
export type VaultView = ReturnType<typeof vaultView>;

/**
 * The current funding window, from authenticated current evidence only: the
 * PDA's version, vault, generation and eligibility, open at the reader's chain
 * time. A stale read claims nothing until a fresh one arrives; a configured
 * timer alone proves no window (frontend-guide.md "Funding and recovery display").
 */
function fundingEvidence(env: FlpEnvelope): { deadline: number } | null {
  const w = env.data.fundingWindow;
  if (!w || !w.authenticated || !w.current || !w.eligible || !w.open || env.cache?.stale)
    return null;
  return { deadline: Number(w.deadline) };
}

/** Scheduled end of `epoch` (a past, current or future one). */
export function epochEnd(v: VaultView, epoch: bigint): number {
  return v.epoch.scheduledEnd + Number(epoch - v.epoch.current) * v.epoch.duration;
}

/** Shares are worth this much USDC at the last-close reference price. */
export function sharesValue(v: VaultView, shares: bigint): bigint {
  return (shares * v.price) / 10n ** BigInt(v.shareDecimals);
}

function statusBlocks(env: FlpEnvelope) {
  const l = env.data.lifecycle;
  const halted = l.depositsPaused || l.breaker || l.mode === 'unwind' || l.mode === 'closed';
  return {
    publicDeposits: halted || l.publicDepositsPaused,
    directDeposits: halted,
    withdrawals: l.withdrawalsPaused,
  };
}

export interface RouteState<R> {
  route: R;
  /** Why the route is closed now, if it is. */
  closed: string | null;
}

export function depositRoutes(env: FlpEnvelope, user: FlpUser | null | undefined) {
  const mode = env.data.lifecycle.mode;
  const blocks = statusBlocks(env);
  const publicClosed =
    (user?.availability.publicDepositsBlockedByStatus ?? blocks.publicDeposits)
      ? 'Public deposits are closed'
      : null;
  const routes: RouteState<DepositRoute>[] = [];
  if (mode === 'pre-deposit') routes.push({ route: 'pre-deposit', closed: publicClosed });
  if (mode === 'live') routes.push({ route: 'queued', closed: publicClosed });
  if (user?.depositApproved && (mode === 'pre-deposit' || mode === 'live')) {
    routes.push({
      route: 'direct',
      closed: user.availability.depositsBlockedByStatus ? 'Direct deposits are paused' : null,
    });
  }
  return routes;
}

/**
 * Withdrawal routes. With a known wallet (`user` not undefined) only the ones
 * it has a balance for; before that, every route the phase allows.
 */
export function withdrawRoutes(env: FlpEnvelope, user: FlpUser | null | undefined, shares: bigint) {
  const mode = env.data.lifecycle.mode;
  const paused =
    (user?.availability.withdrawalsBlockedByStatus ?? statusBlocks(env).withdrawals)
      ? 'Withdrawals are paused'
      : null;
  const known = user !== undefined;
  const principal = BigInt(user?.refundablePublicPrincipal ?? '0');
  const hasShares = !known || shares > 0n;
  const routes: RouteState<WithdrawRoute>[] = [];
  if (mode === 'pre-deposit') {
    // Refunds of public principal work through a trading pause.
    if (!known || principal > 0n) routes.push({ route: 'refund', closed: null });
    if (shares > 0n && user?.depositApproved) {
      const deferred = env.data.queues.deferredHead !== null;
      routes.push({
        route: 'instant',
        closed: paused ?? (deferred ? 'An older withdrawal batch is funded first' : null),
      });
    }
    if (shares > 0n) routes.push({ route: 'queued', closed: paused });
  }
  if (mode === 'live' && hasShares) routes.push({ route: 'queued', closed: paused });
  if (mode === 'closed' && hasShares) routes.push({ route: 'redeem', closed: null });
  return routes;
}

/**
 * Whether Deposit and Withdraw lead anywhere for this wallet: the one source
 * for the vault page buttons and the form (an approved wallet keeps the direct
 * deposit through a public-only pause, frontend-guide.md B.2 rule 19).
 */
export function availability(env: FlpEnvelope, user: FlpUser | null | undefined, shares: bigint) {
  const deposit = depositRoutes(env, user);
  const withdraw = withdrawRoutes(env, user, shares);
  const mode = env.data.lifecycle.mode;
  return {
    canDeposit: deposit.some(r => !r.closed),
    depositReason:
      deposit.find(r => r.closed)?.closed ??
      (mode === 'unwind' || mode === 'closed' ? 'The vault no longer takes deposits' : null),
    canWithdraw: withdraw.some(r => !r.closed),
    withdrawReason:
      withdraw.find(r => r.closed)?.closed ??
      (mode === 'unwind'
        ? 'Withdrawals wait until the vault finishes unwinding'
        : user !== undefined
          ? 'Nothing to withdraw'
          : null),
  };
}

/**
 * Standing unsettled-profit risk, with the disclosure a deposit form must show
 * whether or not the amount is known, and the operator notice tier.
 */
export function upnlRisk(env: FlpEnvelope) {
  const r = env.data.standingUpnlRisk;
  if (!r) return null;
  const gross = r.grossPositiveUnsettledPnlQuoteNative;
  const ratio = r.upnlToNavRatio;
  const tier1 = r.monitor?.tier1.status;
  const tier2 = r.monitor?.tier2.status;
  return {
    amount: 'raw' in gross ? fixedToNative(gross) : null,
    /** Share of NAV in basis points; null when unknown. */
    bps: 'raw' in ratio ? Number(fixedScaled(ratio, 4)) : null,
    reason: 'raw' in gross ? null : gross.reason,
    disclosure: r.depositDisclosure,
    definition: r.definition,
    /** Tier 2 outranks tier 1. Both request settlement; neither is a breaker. */
    notice:
      tier2 === 'page-operator'
        ? ('page-operator' as const)
        : tier1 === 'operator-notice'
          ? ('operator-notice' as const)
          : null,
    /** Missing or stale duration history: the duration rule can't be judged. */
    durationUnknown: tier1 === 'duration-unknown' || tier2 === 'history-unknown',
  };
}

/** A new request conflicts with a ticket left for another epoch (6008). */
export function ticketBlocks(ticket: FlpTicket | undefined, target: bigint): boolean {
  if (!ticket || ticket.state === 'none') return false;
  return !(ticket.state === 'queued' && BigInt(ticket.ticket.epoch) === target);
}
