/**
 * Application constants
 */
import { PublicKey } from '@solana/web3.js';
import type { Commitment } from '@solana/web3.js';

// config -> network ( devnet / mainnet ) -> programId / rpcUrl , commitment , etc...
export const config = {
  devnet: {
    // Default to same-origin proxy paths (configured in vite.config.js) to avoid CORS issues.
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/harness',
    // Local HTTP bridge proxy path for relay submit + TimeScaleDB candle fallback.
    relayBridgeUrl: import.meta.env.VITE_RELAY_BRIDGE_URL || '/bridge',
    timescaleApiUrl: import.meta.env.VITE_TIMESCALE_API_URL || '/bridge',
    // Optional, currently unused by harness reads.
    graphApiUrl: import.meta.env.VITE_GRAPH_API_URL || '/harness',
    // Route RPC/WS through frontend origin by default (see vite proxy config).
    rpcUrl: import.meta.env.VITE_RPC_URL || '/solana-rpc',
    commitment: (import.meta.env.VITE_COMMITMENT || 'confirmed') as Commitment,
    wsUrl: import.meta.env.VITE_WS_URL || '/solana-ws',
    // Mango queue/harness defaults
    defaultHarnessMarketId: import.meta.env.VITE_HARNESS_MARKET_ID || '0',
    defaultMarketName: import.meta.env.VITE_MARKET_NAME || 'SOL/USDC Perps',
    mangoProgramId: import.meta.env.VITE_MANGO_PROGRAM_ID || '',
    mangoGroupPk: import.meta.env.VITE_MANGO_GROUP_PK || '',
    mangoExecutionQueuePk: import.meta.env.VITE_MANGO_EXECUTION_QUEUE_PK || '',
    defaultMangoAccountPk: import.meta.env.VITE_MANGO_ACCOUNT_PK || '',
    mangoDepositUiAmount: Number(import.meta.env.VITE_MANGO_DEPOSIT_UI_AMOUNT || '1000'),
    // Harness defaults are lot-native integers; override via env for full on-chain unit scaling.
    baseDecimals: Number(import.meta.env.VITE_BASE_DECIMALS || 0),
    quoteDecimals: Number(import.meta.env.VITE_QUOTE_DECIMALS || 0),
    baseLotSize: Number(import.meta.env.VITE_BASE_LOT_SIZE || 1),
    quoteLotSize: Number(import.meta.env.VITE_QUOTE_LOT_SIZE || 1),
    quoteTokenName: import.meta.env.VITE_QUOTE_TOKEN_SYMBOL || 'USDC',
    baseTokenName: import.meta.env.VITE_BASE_TOKEN_SYMBOL || 'SOL',
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
  candles_ingest: '/candles/ingest',
};
