import {
  Group,
  MangoAccount,
  MangoClient,
  PerpMarketIndex,
  Serum3Orders,
  TokenIndex,
  TokenPosition,
} from '@blockworks-foundation/mango-v4';
import { PublicKey } from '@solana/web3.js';
import type { QueueAccountMeta } from '@/shared/lib/mango-execution-queue';

// Mirror of cont-sdk-fresh/src/context.ts:buildCanonicalPerpRemainingAccounts.
// The on-chain health scanner expects a fixed prefix (group, mango account, owner,
// target perp market + bids/asks/event-queue/oracle) followed by a contiguous
// banks/oracles/perps/serum/fallback section in that exact order — see §4 of the
// v5 intent format changelog. Returning the wrong order produces a valid signature
// but the on-chain enqueue will fail health checks.
export async function buildCanonicalPerpRemainingAccounts(input: {
  client: MangoClient;
  group: Group;
  mangoAccount: MangoAccount;
  userOwner: PublicKey;
  marketIndex: number;
}): Promise<QueueAccountMeta[]> {
  const { client, group, mangoAccount, userOwner, marketIndex } = input;
  const perpMarket = group.getPerpMarketByMarketIndex(marketIndex as PerpMarketIndex);

  const tokenPositionIndices = mangoAccount.tokens.map(t => t.tokenIndex);
  const settlementBank = group.getFirstBankForPerpSettlement();
  const tokenIndexUnset = TokenPosition.TokenIndexUnset as typeof settlementBank.tokenIndex;

  // The settlement bank must be present; if a slot is unused, repurpose it.
  if (
    !tokenPositionIndices.includes(settlementBank.tokenIndex) &&
    tokenPositionIndices.includes(tokenIndexUnset)
  ) {
    const slot = tokenPositionIndices.findIndex(idx => idx === tokenIndexUnset);
    tokenPositionIndices[slot] = settlementBank.tokenIndex;
  }
  if (!tokenPositionIndices.includes(settlementBank.tokenIndex)) {
    throw new Error(
      'all Mango token positions are occupied; cannot build canonical perp execution-queue accounts'
    );
  }

  const mintInfos = uniqueBy(
    tokenPositionIndices
      .filter(idx => idx !== tokenIndexUnset)
      .map(idx => {
        const mintInfo = group.mintInfosMapByTokenIndex.get(idx as TokenIndex);
        if (!mintInfo) throw new Error(`missing mint info for token index ${idx}`);
        return mintInfo;
      }),
    mintInfo => mintInfo.tokenIndex
  );

  const allPerpMarkets = Array.from(group.perpMarketsMapByMarketIndex.values()).sort(
    (a, b) => a.perpMarketIndex - b.perpMarketIndex
  );

  const fallbackMap = await client.deriveFallbackOracleContexts(group);
  const fallbackOracles: PublicKey[] = [];
  for (const oracle of mintInfos.map(m => m.oracle)) {
    const fallback = fallbackMap.get(oracle.toBase58());
    if (fallback) fallbackOracles.push(...fallback);
  }

  const serumOpenOrders = mangoAccount.serum3
    .filter(s => s.marketIndex !== Serum3Orders.Serum3MarketIndexUnset)
    .map(s => s.openOrders);

  const healthAccounts = buildHealthRemainingAccountKeys({
    bankAccounts: mintInfos.map(m => m.firstBank()),
    tokenOracles: mintInfos.map(m => m.oracle),
    perpMarkets: allPerpMarkets.map(m => m.publicKey),
    perpOracles: allPerpMarkets.map(m => m.oracle),
    serumOpenOrders,
    fallbackOracles,
  });

  return [
    meta(group.publicKey, false, false),
    meta(mangoAccount.publicKey, false, true),
    meta(userOwner, false, false),
    meta(perpMarket.publicKey, false, true),
    meta(perpMarket.bids, false, true),
    meta(perpMarket.asks, false, true),
    meta(perpMarket.eventQueue, false, true),
    meta(perpMarket.oracle, false, false),
    ...healthAccounts.map(pubkey => meta(pubkey, false, false)),
  ];
}

function meta(pubkey: PublicKey, is_signer: boolean, is_writable: boolean): QueueAccountMeta {
  return { pubkey: pubkey.toBase58(), is_signer, is_writable };
}

function buildHealthRemainingAccountKeys(sections: {
  bankAccounts: PublicKey[];
  tokenOracles: PublicKey[];
  perpMarkets: PublicKey[];
  perpOracles: PublicKey[];
  serumOpenOrders: PublicKey[];
  fallbackOracles: PublicKey[];
}): PublicKey[] {
  const seen = new Set(sections.tokenOracles.map(k => k.toBase58()));
  const fallbackOracles: PublicKey[] = [];
  for (const fallback of sections.fallbackOracles) {
    const key = fallback.toBase58();
    if (fallback.equals(PublicKey.default) || seen.has(key)) continue;
    seen.add(key);
    fallbackOracles.push(fallback);
  }
  return [
    ...sections.bankAccounts,
    ...sections.tokenOracles,
    ...sections.perpMarkets,
    ...sections.perpOracles,
    ...sections.serumOpenOrders,
    ...fallbackOracles,
  ];
}

function uniqueBy<T, K>(values: T[], keyFn: (value: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
