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
 * `v1:wallet_trades:<owner>` populated by the harness publisher. The
 * publisher emits both shorthand (maker/taker/price/size/side) and legacy
 * alias (maker_owner/taker_owner/price_lots/base_lots/quote_lots/taker_side/
 * maker_order_id/taker_sequence/trade_id) field names on every entry.
 * Readers prefer the legacy shape because it matches the TSDB schema and
 * the existing SSETrade consumer contract verbatim.
 */
interface V2WalletTradeRow {
  id: string;
  market?: string;
  // Shorthand (always present).
  maker?: string;
  taker?: string;
  price?: string;
  size?: string;
  side?: 'bid' | 'ask';
  ts_ms?: string;
  sequence?: string;
  // Legacy aliases (preferred when present).
  trade_id?: string;
  maker_owner?: string;
  taker_owner?: string;
  price_lots?: string;
  base_lots?: string;
  quote_lots?: string;
  taker_side?: 'bid' | 'ask';
  maker_order_id?: string;
  taker_sequence?: string;
  // Server-resolved side of the queried wallet ("buy"/"sell"). Authoritative —
  // the wallet's own buy/sell can't be derived client-side because trades are
  // keyed by mango-account address, not the wallet pubkey.
  wallet_side?: 'buy' | 'sell';
}

/**
 * Translate the v2 wallet-trade row shape to the legacy `SSETrade` shape
 * the UI consumers expect. Prefer the legacy-alias fields because they map
 * to SSETrade field names verbatim; fall back to shorthand so an older
 * publisher build still works.
 */
function v2WalletTradeToSSE(row: V2WalletTradeRow): SSETrade {
  const ts = Number(row.ts_ms ?? 0);
  return {
    trade_id: row.trade_id ?? row.id,
    market: row.market ?? '',
    maker_owner: row.maker_owner ?? row.maker ?? '',
    taker_owner: row.taker_owner ?? row.taker ?? '',
    taker_side: (row.taker_side ?? row.side ?? 'bid') as 'bid' | 'ask',
    price_lots: row.price_lots ?? row.price ?? '0',
    base_lots: row.base_lots ?? row.size ?? '0',
    quote_lots: row.quote_lots ?? '0',
    ts_ms: Number.isFinite(ts) ? ts : 0,
    maker_order_id: row.maker_order_id,
    taker_sequence: row.taker_sequence ?? row.sequence ?? '0',
    wallet_side: row.wallet_side,
  } as SSETrade;
}

export async function fetchWalletTrades(
  pubkey: string,
  { market, limit = 50, before, signal }: FetchWalletTradesParams = {}
): Promise<SSETrade[]> {
  // v2 path (Redis-backed fan-out stream). Legacy /wallet/:pubkey/trades stays
  // behind the feature flag until the v1 route is retired.
  if (config.devnet.useV2ReadLayer) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    // Server-side market filter — the gateway over-reads from the fan-out
    // stream and filters before trimming, so a single-market query returns
    // `limit` trades from that market instead of `limit` trades across all
    // markets post-filtered to potentially zero.
    if (market) params.set('market', market);
    const qs = params.toString();
    const url = `${config.devnet.gatewayUrl}/v2/trades/wallet/${encodeURIComponent(pubkey)}${qs ? `?${qs}` : ''}`;
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
    const rows = (data?.trades ?? []) as V2WalletTradeRow[];
    return rows.map(v2WalletTradeToSSE);
  }

  // Legacy v1 path.
  const params = new URLSearchParams();
  if (market) params.set('market', market);
  if (limit) params.set('limit', String(limit));
  if (before !== undefined) params.set('before', String(before));
  const qs = params.toString();
  const url = `${config.devnet.gatewayUrl}/wallet/${pubkey}/trades${qs ? `?${qs}` : ''}`;

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
  return Array.isArray(data) ? data : [];
}
