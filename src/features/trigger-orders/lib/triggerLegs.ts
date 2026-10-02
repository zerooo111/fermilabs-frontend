/**
 * Stop-loss / take-profit legs (fermi-v1 client-SL-TP.md).
 *
 * A leg is an ordinary v5 PerpPlaceOrderV2 intent — reduce-only IOC, zero
 * envelope timing — sent with `trigger_order` terms. The relayer hands it to
 * the trigger-orders keeper, which resubmits the same signed intent once the
 * market's on-chain oracle crosses the trigger.
 *
 * The terms are not signed separately: the leg's client_order_id (in the
 * intent and in the payload) is the first 8 bytes of sha256 over their
 * canonical encoding, so the one intent signature binds them too.
 *
 * Byte layouts must match the keeper's terms.rs / cancel.rs. Golden vector:
 * scripts/trigger-legs-selftest.ts.
 */
import { PublicKey } from '@solana/web3.js';
import {
  encodePerpPlaceOrderV2QueuePayload,
  QueuePlaceOrderType,
  QueueSelfTradeBehavior,
  QueueSide,
  randomU64,
} from '@/shared/lib/mango-execution-queue';

export const I64_MAX = (1n << 63n) - 1n;

const TERMS_DOMAIN = 'fermi-trigger-terms-v1';
const CANCEL_DOMAIN = 'fermi-trigger-cancel-v1';
const TERMS_VERSION = 1;
// 0 = the market's on-chain oracle; the only source the keeper accepts.
const PRICE_SOURCE_ONCHAIN_ORACLE = 0;

export enum TriggerKind {
  StopLoss = 0,
  TakeProfit = 1,
}

export enum TriggerDirection {
  /** Fire when the oracle price is at or above the trigger. */
  AtOrAbove = 0,
  /** Fire when the oracle price is at or below the trigger. */
  AtOrBelow = 1,
}

export type TriggerTerms = {
  kind: TriggerKind;
  direction: TriggerDirection;
  triggerPriceLots: bigint;
  /** Shared by the legs of one bracket; 0n = independent leg. */
  ocoGroup: bigint;
  /** Unix seconds; also the payload expiry_timestamp. */
  expiryTs: bigint;
  /** Random per leg. */
  salt: bigint;
};

/** `trigger_order` as POST /relay/submit-intent expects it (u64/i64 as strings). */
export type TriggerOrderWire = {
  version: number;
  kind: TriggerKind;
  direction: TriggerDirection;
  trigger_price_lots: string;
  oco_group: string;
  expiry_ts: string;
  salt: string;
  price_source: number;
  flags: number;
};

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function le(bytes: 1 | 2 | 8, value: bigint, signed = false): Uint8Array {
  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer);
  if (bytes === 8) {
    if (signed) view.setBigInt64(0, value, true);
    else view.setBigUint64(0, value, true);
  } else if (bytes === 2) {
    view.setUint16(0, Number(value), true);
  } else {
    view.setUint8(0, Number(value));
  }
  return out;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

/** Canonical terms encoding. Must match terms.rs in the keeper. */
export function triggerTermsBytes(
  group: string,
  mangoAccount: string,
  marketIndex: number,
  terms: TriggerTerms
): Uint8Array {
  return concat(
    new TextEncoder().encode(TERMS_DOMAIN),
    new PublicKey(group).toBytes(),
    new PublicKey(mangoAccount).toBytes(),
    le(2, BigInt(marketIndex)),
    // version, kind, direction, price_source, flags
    Uint8Array.from([TERMS_VERSION, terms.kind, terms.direction, PRICE_SOURCE_ONCHAIN_ORACLE, 0]),
    le(8, terms.triggerPriceLots, true),
    le(8, terms.ocoGroup),
    le(8, terms.expiryTs),
    le(8, terms.salt)
  );
}

/** The client_order_id a leg with these terms must carry. */
export async function triggerTermsCommitment(
  group: string,
  mangoAccount: string,
  marketIndex: number,
  terms: TriggerTerms
): Promise<bigint> {
  const digest = await sha256(triggerTermsBytes(group, mangoAccount, marketIndex, terms));
  return new DataView(digest.buffer).getBigUint64(0, true);
}

/**
 * An ask closes a long, a bid closes a short. Long: stop fires on a fall,
 * take-profit on a rise. Short: the reverse.
 */
export function triggerDirection(side: QueueSide, kind: TriggerKind): TriggerDirection {
  const ask = side === QueueSide.Ask;
  return ask === (kind === TriggerKind.StopLoss)
    ? TriggerDirection.AtOrBelow
    : TriggerDirection.AtOrAbove;
}

/**
 * The IOC limit: marketable at the trigger, at most `slippageBps` worse.
 * A sell rounds down, a buy rounds up, so the limit never ends up on the
 * wrong side of the trigger (the keeper rejects that).
 */
export function triggerLimitPriceLots(
  side: QueueSide,
  triggerPriceLots: bigint,
  slippageBps: number
): bigint {
  const bps = BigInt(Math.max(0, Math.min(9_999, Math.round(slippageBps))));
  return side === QueueSide.Ask
    ? (triggerPriceLots * (10_000n - bps)) / 10_000n
    : (triggerPriceLots * (10_000n + bps) + 9_999n) / 10_000n;
}

export type TriggerLeg = {
  terms: TriggerTerms;
  /** The commitment; goes in the payload and as the intent client_order_id. */
  clientOrderId: bigint;
  payload: Uint8Array;
};

/**
 * Builds one leg's terms, commitment and payload. Pass `salt` only to pin a
 * test vector; it is otherwise random.
 */
export async function buildTriggerLeg(params: {
  group: string;
  mangoAccount: string;
  marketIndex: number;
  side: QueueSide;
  kind: TriggerKind;
  triggerPriceLots: bigint;
  /** Exact base lots, or 'all' to close whatever position exists at fire time. */
  size: bigint | 'all';
  slippageBps: number;
  ocoGroup: bigint;
  expiryTs: bigint;
  salt?: bigint;
  /** Overrides the IOC limit (test vectors only). */
  limitPriceLots?: bigint;
}): Promise<TriggerLeg> {
  if (params.triggerPriceLots <= 0n) {
    throw new Error('Trigger price must be positive');
  }
  if (params.size !== 'all' && params.size <= 0n) {
    throw new Error('Trigger size must be positive');
  }
  const limitPriceLots =
    params.limitPriceLots ??
    triggerLimitPriceLots(params.side, params.triggerPriceLots, params.slippageBps);
  if (limitPriceLots <= 0n) {
    throw new Error('Trigger slippage leaves no valid limit price');
  }

  let salt = params.salt ?? randomU64();
  let terms: TriggerTerms;
  let clientOrderId: bigint;
  // Re-roll in the (2^-64) case the commitment is 0, which the relayer treats
  // as "no randomizer".
  do {
    terms = {
      kind: params.kind,
      direction: triggerDirection(params.side, params.kind),
      triggerPriceLots: params.triggerPriceLots,
      ocoGroup: params.ocoGroup,
      expiryTs: params.expiryTs,
      salt,
    };
    clientOrderId = await triggerTermsCommitment(
      params.group,
      params.mangoAccount,
      params.marketIndex,
      terms
    );
    salt = randomU64();
  } while (clientOrderId === 0n);

  const payload = encodePerpPlaceOrderV2QueuePayload({
    side: params.side,
    priceLots: limitPriceLots,
    // The program's reduce-only clamp caps 'all' at the position.
    maxBaseLots: params.size === 'all' ? I64_MAX : params.size,
    maxQuoteLots: I64_MAX,
    clientOrderId,
    orderType: QueuePlaceOrderType.ImmediateOrCancel,
    // Never AbortTransaction: a stop must not die on a self-trade.
    selfTradeBehavior: QueueSelfTradeBehavior.DecrementTake,
    reduceOnly: true,
    expiryTimestamp: params.expiryTs,
    limit: 10,
  });

  return { terms, clientOrderId, payload };
}

/** A random OCO group shared by the legs of one bracket (never 0). */
export function newOcoGroup(): bigint {
  return randomU64() || 1n;
}

export function triggerOrderWire(terms: TriggerTerms): TriggerOrderWire {
  return {
    version: TERMS_VERSION,
    kind: terms.kind,
    direction: terms.direction,
    trigger_price_lots: terms.triggerPriceLots.toString(),
    oco_group: terms.ocoGroup.toString(),
    expiry_ts: terms.expiryTs.toString(),
    salt: terms.salt.toString(),
    price_source: PRICE_SOURCE_ONCHAIN_ORACLE,
    flags: 0,
  };
}

export type TriggerCancelScope = 'ids' | 'oco_group' | 'all';

export type TriggerCancelParams = {
  group: string;
  mangoAccount: string;
  signer: string;
  issuedAtMs: bigint;
  scope: TriggerCancelScope;
  clientOrderIds?: bigint[];
  ocoGroup?: bigint;
  /** With scope 'all': only legs on this market. */
  marketIndex?: number;
};

const CANCEL_SCOPE_CODE: Record<TriggerCancelScope, bigint> = {
  ids: 0n,
  oco_group: 1n,
  all: 2n,
};

/** The 32-byte hash a cancel is signed over. Must match cancel.rs. */
export async function triggerCancelHash(params: TriggerCancelParams): Promise<Uint8Array> {
  const ids = params.clientOrderIds ?? [];
  return sha256(
    concat(
      new TextEncoder().encode(CANCEL_DOMAIN),
      new PublicKey(params.group).toBytes(),
      new PublicKey(params.mangoAccount).toBytes(),
      new PublicKey(params.signer).toBytes(),
      le(8, params.issuedAtMs),
      le(1, CANCEL_SCOPE_CODE[params.scope]),
      le(2, BigInt(params.marketIndex ?? 0xffff)),
      le(8, params.ocoGroup ?? 0n),
      le(2, BigInt(ids.length)),
      ...ids.map(id => le(8, id))
    )
  );
}

export function triggerCancelBody(params: TriggerCancelParams, signatureB64: string) {
  return {
    mango_account: params.mangoAccount,
    signer: params.signer,
    issued_at_ms: params.issuedAtMs.toString(),
    scope: params.scope,
    client_order_ids: (params.clientOrderIds ?? []).map(String),
    oco_group: params.ocoGroup !== undefined ? params.ocoGroup.toString() : null,
    market_index: params.marketIndex ?? null,
    signature_b64: signatureB64,
  };
}

/** Inverse of uiPriceToLots, for showing a leg's trigger price. */
export function priceLotsToUi(
  priceLots: bigint | number | string,
  market: { baseDecimals: number; quoteDecimals: number; baseLotSize: number; quoteLotSize: number }
): number {
  return (
    (Number(priceLots) * market.quoteLotSize * 10 ** market.baseDecimals) /
    (market.baseLotSize * 10 ** market.quoteDecimals)
  );
}
