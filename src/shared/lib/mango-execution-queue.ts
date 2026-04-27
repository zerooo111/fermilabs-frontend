import { PublicKey } from '@solana/web3.js';

export const USER_INTENT_DOMAIN = 'mango-v4-user-intent-v1';
export const USER_INTENT_DOMAIN_V2 = 'mango-v5-user-intent-v2';
export const USER_INTENT_DOMAIN_V5_DIRECT = 'mango-v5-direct-intent-v1';
const SYSVAR_INSTRUCTIONS_PUBKEY = 'Sysvar1nstructions1111111111111111111111111';

export type QueueAccountMeta = {
  pubkey: string;
  is_signer: boolean;
  is_writable: boolean;
};

export enum QueuePayloadVariant {
  PerpPlaceOrderV2 = 0,
  PerpCancelOrder = 1,
}

export enum IntentTargetKind {
  PerpMarket = 0,
}

export enum QueueSide {
  Bid = 0,
  Ask = 1,
}

export enum QueuePlaceOrderType {
  Limit = 0,
  ImmediateOrCancel = 1,
  PostOnly = 2,
  Market = 3,
  PostOnlySlide = 4,
}

export enum QueueSelfTradeBehavior {
  DecrementTake = 0,
  CancelProvide = 1,
  AbortTransaction = 2,
}

function u8(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`u8 out of range: ${value}`);
  }
  return Uint8Array.from([value]);
}

function u16ToLe(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error(`u16 out of range: ${value}`);
  }
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u64ToLe(value: bigint): Uint8Array {
  const max = (1n << 64n) - 1n;
  if (value < 0n || value > max) {
    throw new Error(`u64 out of range: ${value.toString()}`);
  }
  const bytes = new Uint8Array(8);
  let x = value;
  for (let i = 0; i < 8; i += 1) {
    bytes[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return bytes;
}

function i64ToLe(value: bigint): Uint8Array {
  const min = -(1n << 63n);
  const max = (1n << 63n) - 1n;
  if (value < min || value > max) {
    throw new Error(`i64 out of range: ${value.toString()}`);
  }
  let x = value;
  if (x < 0) {
    x = (1n << 64n) + x;
  }
  return u64ToLe(x);
}

function u128ToLe(value: bigint): Uint8Array {
  const max = (1n << 128n) - 1n;
  if (value < 0n || value > max) {
    throw new Error(`u128 out of range: ${value.toString()}`);
  }
  const bytes = new Uint8Array(16);
  let x = value;
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return bytes;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function decimalToScaledBigInt(value: string | number, decimals: number): bigint {
  const raw = String(value).trim();
  if (!raw) return 0n;

  const isNegative = raw.startsWith('-');
  const unsigned = isNegative ? raw.slice(1) : raw;
  const [whole, frac = ''] = unsigned.split('.');
  const normalizedWhole = whole.replace(/^0+/, '') || '0';
  const normalizedFrac = frac.replace(/\D/g, '').slice(0, decimals).padEnd(decimals, '0');
  const combined = `${normalizedWhole}${normalizedFrac}`.replace(/^0+/, '') || '0';
  const result = BigInt(combined);
  return isNegative ? -result : result;
}

export function uiPriceToLots(params: {
  uiPrice: string | number;
  baseDecimals: number;
  quoteDecimals: number;
  baseLotSize: string | number | bigint;
  quoteLotSize: string | number | bigint;
}): bigint {
  const quoteNative = decimalToScaledBigInt(params.uiPrice, params.quoteDecimals);
  const baseLot = BigInt(params.baseLotSize);
  const quoteLot = BigInt(params.quoteLotSize);
  const baseDecimalsScale = 10n ** BigInt(params.baseDecimals);
  return (quoteNative * baseLot) / (quoteLot * baseDecimalsScale);
}

export function uiBaseToLots(params: {
  uiQuantity: string | number;
  baseDecimals: number;
  baseLotSize: string | number | bigint;
}): bigint {
  const baseNative = decimalToScaledBigInt(params.uiQuantity, params.baseDecimals);
  return baseNative / BigInt(params.baseLotSize);
}

export function uiQuoteToLots(params: {
  uiQuote: string | number;
  quoteDecimals: number;
  quoteLotSize: string | number | bigint;
}): bigint {
  const quoteNative = decimalToScaledBigInt(params.uiQuote, params.quoteDecimals);
  return quoteNative / BigInt(params.quoteLotSize);
}

export function encodePerpPlaceOrderV2QueuePayload(fields: {
  side: QueueSide;
  priceLots: bigint;
  maxBaseLots: bigint;
  maxQuoteLots: bigint;
  clientOrderId: bigint;
  orderType: QueuePlaceOrderType;
  selfTradeBehavior: QueueSelfTradeBehavior;
  reduceOnly: boolean;
  expiryTimestamp: bigint;
  limit: number;
}): Uint8Array {
  const body = concatBytes(
    u8(fields.side),
    i64ToLe(fields.priceLots),
    i64ToLe(fields.maxBaseLots),
    i64ToLe(fields.maxQuoteLots),
    u64ToLe(fields.clientOrderId),
    u8(fields.orderType),
    u8(fields.selfTradeBehavior),
    u8(fields.reduceOnly ? 1 : 0),
    u64ToLe(fields.expiryTimestamp),
    u8(fields.limit)
  );
  return encodeQueuePayloadV1(QueuePayloadVariant.PerpPlaceOrderV2, body);
}

export function encodePerpCancelOrderQueuePayload(orderId: bigint): Uint8Array {
  return encodeQueuePayloadV1(QueuePayloadVariant.PerpCancelOrder, u128ToLe(orderId));
}

function encodeQueuePayloadV1(variant: QueuePayloadVariant, body: Uint8Array): Uint8Array {
  return concatBytes(u8(1), u8(variant), u16ToLe(0), body);
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

export async function hashExecutionQueuePayload(payload: Uint8Array): Promise<Uint8Array> {
  return await sha256(payload);
}

function mergeEffectiveRuntimeFlags(
  remainingAccounts: QueueAccountMeta[],
  fixedAccounts: QueueAccountMeta[]
): QueueAccountMeta[] {
  const merged = new Map<string, { is_signer: boolean; is_writable: boolean }>();
  for (const account of [...fixedAccounts, ...remainingAccounts]) {
    const existing = merged.get(account.pubkey);
    if (!existing) {
      merged.set(account.pubkey, {
        is_signer: !!account.is_signer,
        is_writable: !!account.is_writable,
      });
      continue;
    }
    existing.is_signer = existing.is_signer || !!account.is_signer;
    existing.is_writable = existing.is_writable || !!account.is_writable;
  }
  return remainingAccounts.map(account => {
    const effective = merged.get(account.pubkey);
    return {
      pubkey: account.pubkey,
      is_signer: effective?.is_signer || false,
      is_writable: effective?.is_writable || false,
    };
  });
}

async function hashExecutionQueueAccounts(accounts: QueueAccountMeta[]): Promise<Uint8Array> {
  const bytes: number[] = [];
  for (const account of accounts) {
    const pubkeyBytes = new PublicKey(account.pubkey).toBytes();
    bytes.push(...pubkeyBytes);
    bytes.push(account.is_signer ? 1 : 0);
    bytes.push(account.is_writable ? 1 : 0);
  }
  return await sha256(Uint8Array.from(bytes));
}

export async function hashExecutionQueueAccountsForCtmEnqueue(params: {
  group: string;
  executionQueue: string;
  remainingAccounts: QueueAccountMeta[];
}): Promise<Uint8Array> {
  const effectiveRemaining = mergeEffectiveRuntimeFlags(params.remainingAccounts, [
    {
      pubkey: params.group,
      is_signer: false,
      is_writable: true,
    },
    {
      pubkey: params.executionQueue,
      is_signer: false,
      is_writable: true,
    },
    {
      pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
      is_signer: false,
      is_writable: false,
    },
  ]);
  return await hashExecutionQueueAccounts(effectiveRemaining);
}

export async function buildExecutionQueueUserIntent(params: {
  group: string;
  executionQueue: string;
  mangoAccount: string;
  userOwner: string;
  payload: Uint8Array;
  remainingAccounts: QueueAccountMeta[];
  intentVersion?: number;
  targetKind?: number;
  targetIndex?: number;
  clientOrderId?: bigint;
  minExecuteSlot?: bigint;
  expiresAtSlot?: bigint;
}): Promise<{
  kind: number;
  payloadHash: Uint8Array;
  accountsHash: Uint8Array;
  userIntentMessage: Uint8Array;
}> {
  const kind = 0;
  const intentVersion = params.intentVersion ?? 1;
  const payloadHash = await hashExecutionQueuePayload(params.payload);
  const accountsHash = await hashExecutionQueueAccountsForCtmEnqueue({
    group: params.group,
    executionQueue: params.executionQueue,
    remainingAccounts: params.remainingAccounts,
  });
  const userIntentMessage = await buildUserIntentMessage({
    group: params.group,
    mangoAccount: params.mangoAccount,
    userOwner: params.userOwner,
    intentVersion,
    targetKind: params.targetKind,
    targetIndex: params.targetIndex,
    kind,
    payloadHash,
    accountsHash,
    clientOrderId: params.clientOrderId,
    minExecuteSlot: params.minExecuteSlot,
    expiresAtSlot: params.expiresAtSlot,
  });
  return {
    kind,
    payloadHash,
    accountsHash,
    userIntentMessage,
  };
}

export async function buildUserIntentMessage(params: {
  group: string;
  mangoAccount: string;
  userOwner: string;
  intentVersion?: number;
  targetKind?: number;
  targetIndex?: number;
  kind: number;
  payloadHash: Uint8Array;
  accountsHash: Uint8Array;
  clientOrderId?: bigint;
  minExecuteSlot?: bigint;
  expiresAtSlot?: bigint;
}): Promise<Uint8Array> {
  const intentVersion = params.intentVersion ?? 1;
  if (intentVersion === 2) {
    if (params.targetKind === undefined || params.targetIndex === undefined) {
      throw new Error('v2 intent requires targetKind and targetIndex');
    }
    return await sha256(
      concatBytes(
        new TextEncoder().encode(USER_INTENT_DOMAIN_V2),
        new PublicKey(params.group).toBytes(),
        new PublicKey(params.mangoAccount).toBytes(),
        new PublicKey(params.userOwner).toBytes(),
        u8(params.kind),
        u8(params.targetKind),
        u16ToLe(params.targetIndex),
        params.payloadHash,
        params.accountsHash,
        u64ToLe(params.minExecuteSlot ?? 0n),
        u64ToLe(params.expiresAtSlot ?? 0n),
        u64ToLe(params.clientOrderId ?? 0n)
      )
    );
  }

  return await sha256(
    concatBytes(
      new TextEncoder().encode(USER_INTENT_DOMAIN),
      new PublicKey(params.group).toBytes(),
      new PublicKey(params.mangoAccount).toBytes(),
      new PublicKey(params.userOwner).toBytes(),
      u8(params.kind),
      params.payloadHash,
      params.accountsHash
    )
  );
}

export function randomU64(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const view = new DataView(bytes.buffer);
  return view.getBigUint64(0, true);
}

export function deriveExecutionQueueV5Pda(
  programId: string,
  group: string,
  marketIndex: number
): PublicKey {
  const indexBytes = u16ToLe(marketIndex);
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('execution-queue-v5'), new PublicKey(group).toBytes(), indexBytes],
    new PublicKey(programId)
  )[0];
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
