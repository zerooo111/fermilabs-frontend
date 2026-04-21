import { config } from '@/shared/config/constants';
import type { SSETrade } from './sse-types';

export interface FetchWalletTradesParams {
  market?: string;
  limit?: number;
  before?: number;
  signal?: AbortSignal;
}

/**
 * v2 wallet-trades row — Redis stream entry shape from
 * `v1:wallet_trades:<owner>` populated by the harness publisher.
 */
interface V2WalletTradeRow {
  id: string;
  market?: string;
  maker?: string;
  taker?: string;
  price?: string;
  size?: string;
  side?: 'bid' | 'ask';
  ts_ms?: string;
  sequence?: string;
}

/**
 * Translate the v2 wallet-trade row shape to the legacy `SSETrade` shape
 * the UI consumers expect. Field names differ (price → price_lots,
 * size → base_lots, side → taker_side, etc.) but the data is the same.
 */
function v2WalletTradeToSSE(row: V2WalletTradeRow): SSETrade {
  const ts = Number(row.ts_ms ?? 0);
  return {
    trade_id: row.id,
    market: row.market ?? '',
    maker_owner: row.maker ?? '',
    taker_owner: row.taker ?? '',
    taker_side: (row.side ?? 'bid') as 'bid' | 'ask',
    price_lots: row.price ?? '0',
    base_lots: row.size ?? '0',
    quote_lots: '0',
    ts_ms: Number.isFinite(ts) ? ts : 0,
    taker_sequence: row.sequence ?? '0',
    // Optional fields present on some v1 payloads — null-safe absence is fine.
  } as SSETrade;
}

export async function fetchWalletTrades(
  pubkey: string,
  { market, limit = 50, before, signal }: FetchWalletTradesParams = {}
): Promise<SSETrade[]> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();

  // v2 path (Redis-backed fan-out stream). Legacy /wallet/:pubkey/trades stays
  // behind the feature flag until the v1 route is retired.
  const path = config.devnet.useV2ReadLayer
    ? `/v2/trades/wallet/${encodeURIComponent(pubkey)}${qs ? `?${qs}` : ''}`
    : (() => {
        if (market) params.set('market', market);
        if (before !== undefined) params.set('before', String(before));
        const legacyQs = params.toString();
        return `/wallet/${pubkey}/trades${legacyQs ? `?${legacyQs}` : ''}`;
      })();
  const url = `${config.devnet.gatewayUrl}${path}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    let message = `Failed to fetch wallet trades (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore json parse error */
    }
    throw new Error(message);
  }

  const data = await res.json();
  if (config.devnet.useV2ReadLayer) {
    const rows = (data?.trades ?? []) as V2WalletTradeRow[];
    let mapped = rows.map(v2WalletTradeToSSE);
    // Client-side `market` filter for parity with the legacy server-side one.
    if (market) mapped = mapped.filter(t => t.market === market);
    return mapped;
  }
  return Array.isArray(data) ? data : [];
}
