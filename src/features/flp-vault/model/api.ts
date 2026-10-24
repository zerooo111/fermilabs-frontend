/**
 * FLP data API (the Fermi state harness) and the devnet helper services.
 * Display data comes from here, not from account polling; the SDK reads the
 * chain only to build transactions. Field meanings: fermi-v1
 * flp-vault/docs/data-endpoints.md. Native amounts stay decimal strings until
 * they're parsed with BigInt.
 */
import { FLP_API_URL } from './config';
import { parseEnvelope } from './schema';

/** `{ raw, fractionalBits }`: native units are raw / 2^fractionalBits. */
export interface Fixed {
  raw: string;
  fractionalBits: number;
}
/** A value the API can't give; show "not available" with the reason. */
export interface Unknown {
  value: null;
  reason: string;
}

export type FlpMode = 'pre-deposit' | 'live' | 'unwind' | 'closed';
export type TicketState =
  | 'none'
  | 'queued'
  | 'claimable-shares'
  | 'refund-only'
  | 'funded-claimable'
  | 'deferred'
  | 'unavailable';

export interface FlpTicket {
  state: TicketState;
  ticket: { requestId: string; epoch: string; amount: string; aux: string };
  claimable: string;
  claimableUnit?: 'share-native' | 'quote-native';
  cancellable: boolean;
  exposedShares: string;
  reason?: string;
}

export interface FlpPosition {
  marketIndex: number;
  market: string;
  name: string;
  baseLotSize: string;
  quoteLotSize: string;
  baseLots: string;
  bidsBaseLots: string;
  asksBaseLots: string;
  baseNativeIncludingTaker: string;
  signedExposureSettlementNative: Fixed;
  quotePositionNative: Fixed;
  unsettledPnlSettlementNative: Fixed;
  unsettledFundingNative: Fixed;
  oraclePriceSettlementNativePerBaseNative: Fixed;
}

export interface FlpPortfolio {
  status: string;
  warnings: string[];
  valuation: {
    spotQuoteNative: Fixed;
    unsettledPerpQuoteNative: Fixed;
    idleQuoteNative: string;
    indicativeNavQuoteNative: Fixed;
  };
  collateral: Array<{
    tokenIndex: number;
    mint: string;
    decimals: number;
    balanceNative: Fixed;
    quoteValueNative: Fixed;
  }>;
  positions: FlpPosition[];
  openOrders: {
    items: Array<{ orderId?: string; clientOrderId?: string; marketIndex?: number; side?: string }>;
  };
  health: {
    initReferenceNative: Fixed;
    maintReferenceNative: Fixed;
    initRatioPercent: Fixed;
  };
}

export interface FlpParams {
  epochDurationS: number;
  requestCutoffS: number;
  mgmtFeeBps: number;
  perfFeeBps: number;
  depositFeeBps: number;
  withdrawFeeBps: number;
  tvlCap: string;
  minDeposit: string;
  minWithdrawShares: string;
}

export interface FlpUser {
  owner: string;
  depositApproved: boolean;
  sharesHeld: string;
  investedSharesIncludingOwedAndUnfunded: string;
  refundablePublicPrincipal: string;
  graduationClaimableShares: string;
  terminalRedeemableHeldSharesQuote: string | null;
  deposit: FlpTicket;
  withdrawal: FlpTicket;
  availability: {
    publicEscrowDepositMode: boolean;
    approvedImmediateDepositMode: boolean;
    queuedDepositMode: boolean;
    depositsBlockedByStatus: boolean;
    publicDepositsBlockedByStatus: boolean;
    withdrawalsBlockedByStatus: boolean;
  };
  pnl: {
    recordedRealizedQuote: string;
    heldSharesCostBasisQuote: string;
    totalDepositedRecorded: string;
    totalWithdrawnRecorded: string;
    currentUnrealized:
      | { value: string; indicativeInvestedValueQuote: string; reason?: string }
      | Unknown;
  };
}

export interface FlpVaultData {
  units: { quoteMint: string; quoteDecimals: number; shareMint: string; shareDecimals: number };
  addresses: {
    group: string;
    fermiAccount: string;
    quoteBank: string;
    depositEscrow: string;
    redemptionEscrow: string;
  };
  lifecycle: {
    mode: FlpMode;
    statusBits: number;
    depositsPaused: boolean;
    publicDepositsPaused: boolean;
    withdrawalsPaused: boolean;
    breaker: boolean;
    graduation: { liveStartedAt: string };
  };
  configuration: { params: FlpParams; delegate: string };
  epoch: {
    current: string;
    startedAt: string;
    scheduledEnd: string;
    cutoffAt: string;
    requestTarget: string;
    fundingWindowEndsAt: string;
  };
  shares: { mintedSupply: string; owedUnminted: string; pricingSupply: string };
  valuation: {
    currentNav: { value: Fixed | null; reason?: string };
    lastProgramNav: {
      slot: string;
      navMid: string;
      navLow: string;
      navHigh: string;
      stale: boolean;
      slotLag: string;
    };
    segregated: {
      depositEscrowBalance: string;
      publicRefundablePrincipal: string;
      queuedDepositGross: string;
      redemptionEscrowBalance: string;
    };
  };
  fees: { highWaterMarkPriceE12: string };
  flows: {
    inceptionTs: string;
    totalDepositedGross: string;
    totalWithdrawnNet: string;
    netDeposits: string;
    activeDepositors: number;
  };
  pnl: { unsettledTradingQuoteNative: Fixed | null };
  queues: { deferredHead: string | null };
  /** Gross positive unsettled PnL: a deposit interface must show it with its disclosure. */
  standingUpnlRisk?: {
    definition: string;
    depositDisclosure: string;
    grossPositiveUnsettledPnlQuoteNative: Fixed;
    /** Fraction of current indicative NAV. */
    upnlToNavRatio: Fixed;
  };
  portfolio: FlpPortfolio | Unknown | null;
  user: FlpUser | null;
}

export interface FlpEnvelope {
  schema_version: number;
  generated_ts_ms: number;
  source: { slot: string; chain_unix_timestamp: string };
  vault: string;
  owner: string | null;
  user_account_exists: boolean | null;
  data: FlpVaultData;
  /** The harness serves a stale copy while it refreshes in the background. */
  cache?: {
    hit: boolean;
    age_ms: number;
    stale?: boolean;
    refreshing?: boolean;
    refresh_error?: string | null;
  };
}

export interface FlpOrder {
  side: string;
  price_lots: string;
  base_lots: string;
  client_order_id?: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${FLP_API_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ? `${body.error} (HTTP ${res.status})` : `HTTP ${res.status}`);
  }
  return res.json();
}

/** The vault, plus the user's tickets and balances when `owner` is given. */
export async function fetchVaultData(vault: string, owner: string | null): Promise<FlpEnvelope> {
  const body = await getJson<unknown>(`/state/vaults/${vault}${owner ? `/users/${owner}` : ''}`);
  // Validated at the boundary (schema.ts): a changed field fails here, not in the UI.
  return parseEnvelope(body);
}

/** Resting orders of `owner` (the vault authority) on one perp market, with price and size. */
export async function fetchOrders(marketIndex: number, owner: string): Promise<FlpOrder[]> {
  const body = await getJson<{ data: FlpOrder[] }>(`/state/orders/${marketIndex}?owner=${owner}`);
  return body.data ?? [];
}

export class FlpHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const res = await fetch(`${FLP_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.error ?? data?.message;
    throw new FlpHttpError(
      res.status,
      res.status === 429
        ? 'Rate limited. Try again in a minute.'
        : detail
          ? `${detail} (HTTP ${res.status})`
          : `HTTP ${res.status}`
    );
  }
  return data as T;
}

/**
 * Mint test USDC to `wallet`. `amount` is a decimal string, max 6 decimals.
 * Reuse `idempotencyKey` to retry the same request (a 409 or 503 must never
 * be resent under a new key); make a new one for each new request.
 */
export function requestFaucet(wallet: string, amount: string, idempotencyKey: string) {
  return post<{ state: string; signature?: string }>('/faucet', { wallet, amount }, idempotencyKey);
}

/** Approve `wallet` for direct deposits on the whitelist vault (vault 3). */
export function requestWhitelist(wallet: string) {
  // One key per wallet, so a retry can't approve twice.
  return post<{ state: string; signature?: string }>('/whitelist', { wallet }, `wl-${wallet}`);
}
