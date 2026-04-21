/**
 * Application constants
 */
import { PublicKey } from '@solana/web3.js';
import type { Commitment } from '@solana/web3.js';

export const V2_READ_LAYER_STORAGE_KEY = 'fermi.useV2ReadLayer';

function resolveV2ReadLayerFlag(): boolean {
  const envDefault = (import.meta.env.VITE_USE_V2_READ_LAYER || 'false').toLowerCase() === 'true';
  if (typeof window === 'undefined') return envDefault;
  try {
    const stored = window.localStorage.getItem(V2_READ_LAYER_STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // localStorage unavailable (SSR, privacy mode) — fall back to env.
  }
  return envDefault;
}

// config -> network ( devnet / mainnet ) -> programId / rpcUrl , commitment , etc...
export const config = {
  devnet: {
    // Unified API gateway for all backend services (state harness, relay bridge, candles).
    gatewayUrl: import.meta.env.VITE_GATEWAY_URL || 'https://v1.fermi.trade',
    rpcUrl: import.meta.env.VITE_RPC_URL || 'https://api.devnet.solana.com',
    commitment: (import.meta.env.VITE_COMMITMENT || 'confirmed') as Commitment,
    wsUrl: import.meta.env.VITE_WS_URL || 'wss://api.devnet.solana.com',
    // Mango queue/harness defaults
    defaultHarnessMarketId: import.meta.env.VITE_HARNESS_MARKET_ID || '0',
    defaultMarketName: import.meta.env.VITE_MARKET_NAME || 'SOL/USDC Perps',
    mangoProgramId: import.meta.env.VITE_MANGO_PROGRAM_ID || '',
    mangoGroupPk: import.meta.env.VITE_MANGO_GROUP_PK || '',
    mangoExecutionQueuePk: import.meta.env.VITE_MANGO_EXECUTION_QUEUE_PK || '',
    defaultMangoAccountPk: import.meta.env.VITE_MANGO_ACCOUNT_PK || '',
    mangoDepositUiAmount: Number(import.meta.env.VITE_MANGO_DEPOSIT_UI_AMOUNT || '1000'),
    // Fallback to the active SOL/USDC perp defaults when harness metadata is unavailable.
    baseDecimals: Number(import.meta.env.VITE_BASE_DECIMALS || 9),
    quoteDecimals: Number(import.meta.env.VITE_QUOTE_DECIMALS || 6),
    baseLotSize: Number(import.meta.env.VITE_BASE_LOT_SIZE || 100000),
    quoteLotSize: Number(import.meta.env.VITE_QUOTE_LOT_SIZE || 10),
    quoteTokenName: import.meta.env.VITE_QUOTE_TOKEN_SYMBOL || 'USDC',
    baseTokenName: import.meta.env.VITE_BASE_TOKEN_SYMBOL || 'SOL',
    // Phase 4 canary: flip to use the Redis-backed /v2/* read layer on the
    // gateway instead of the legacy /state/* harness-proxy endpoints.
    // Resolved at module-load: localStorage override (set by the in-app
    // DevToggle) wins over the VITE env. Toggle triggers a page reload so
    // every `config.devnet.useV2ReadLayer` reader re-evaluates.
    useV2ReadLayer: resolveV2ReadLayerFlag(),
    v2View: (import.meta.env.VITE_V2_VIEW || 'optimistic') as 'optimistic' | 'confirmed',
  },
};

export const marketId = import.meta.env.VITE_MARKET_ID || config.devnet.defaultHarnessMarketId;
export const baseMint = new PublicKey(
  import.meta.env.VITE_BASE_MINT || 'So11111111111111111111111111111111111111112'
);
export const quoteMint = new PublicKey(
  import.meta.env.VITE_QUOTE_MINT || '11111111111111111111111111111111'
);

export const BASE_DECIMALS = config.devnet.baseDecimals;
export const QUOTE_DECIMALS = config.devnet.quoteDecimals;

export const Side = {
  Bid: { bid: {} },
  Ask: { ask: {} },
};

export const OrderType = {
  Limit: { limit: {} },
  ImmediateOrCancel: { immediateOrCancel: {} },
  PostOnly: { postOnly: {} },
  Market: { market: {} },
  PostOnlySlide: { postOnlySlide: {} },
};

export const SelfTradeBehavior = {
  DecrementTake: { decrementTake: {} },
  CancelProvide: { cancelProvide: {} },
  AbortTransaction: { abortTransaction: {} },
};

// Phase 4 canary: new Redis-backed read-layer routes. Served directly from the
// gateway; no harness in the hot path. Gated behind `config.devnet.useV2ReadLayer`.
export const API_ROUTES_V2 = {
  healthz: '/v2/healthz',
  markets: '/v2/markets',
  snapshot_orderbook: '/v2/snapshot/orderbook/{marketId}',
  snapshot_balance: '/v2/snapshot/balance/{owner}',
  snapshot_position: '/v2/snapshot/position/{owner}/{marketId}',
  snapshot_market: '/v2/snapshot/market/{marketId}',
  snapshot_account: '/v2/snapshot/account/{owner}',
  snapshot_orders: '/v2/snapshot/orders/{owner}',
  trades: '/v2/trades/{marketId}',
  candles: '/v2/candles/{marketId}',
  stats_volume_24h: '/v2/stats/volume/24h',
  events: '/v2/events/{marketId}',
  snapshot_and_stream: '/v2/events/snapshot-and-stream/{marketId}',
  stream_frontend: '/v2/stream/frontend/{marketId}',
  stream_trades: '/v2/stream/trades',
};

export const API_ROUTES = {
  health: '/healthz',
  markets: '/state/full',
  market_by_id: '/state/markets/{marketId}',
  market_orderbook: '/state/markets/{marketId}',
  market_orderbook_summary: '/state/markets/{marketId}',
  market_orderbook_depth: '/state/markets/{marketId}',
  market_trades: '/state/trades/{marketId}',
  market_funding: '/state/markets/{marketId}',
  market_candles: '/state/candles/{marketId}',
  user_orders: '/state/orders/{marketId}',
  user_balances: '/state/balances/{pubkey}',
  user_accounts: '/state/users/{pubkey}',
  deposit_context: '/state/deposit-context/{pubkey}',
  positions: '/state/users/{pubkey}',
  liquidations: '/state/queue/{marketId}',
  airdrop: '/airdrop',
  airdrop_deposit: '/airdrop-deposit',
  tx: '/relay/submit-intent',
  relay_config: '/relay/config',
  register_lane: '/admin/register-lane',
  candles_ingest: '/candles/ingest',
  volume_24h: '/stats/volume/24h',
};
