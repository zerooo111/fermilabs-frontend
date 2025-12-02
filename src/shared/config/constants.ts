/**
 * Application constants
 */
import { PublicKey } from '@solana/web3.js';
import type { Commitment } from '@solana/web3.js';

// config -> network ( devnet / mainnet ) -> programId / rpcUrl , commitment , etc...
export const config = {
  devnet: {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.fermi.trade/api/v1',
    rpcUrl: import.meta.env.VITE_RPC_URL || 'https://api.devnet.solana.com',
    commitment: (import.meta.env.VITE_COMMITMENT || 'confirmed') as Commitment,
    wsUrl: import.meta.env.VITE_WS_URL || 'wss://api.devnet.solana.com',
    defaultMarketAddress:
      import.meta.env.VITE_DEFAULT_MARKET_ADDRESS || 'GnDethiMd2Z1ANCeSAcP7fxRWXL64FM6dNJowho6Knxt',
    vaultProgramId:
      import.meta.env.VITE_VAULT_PROGRAM_ID || 'CVB232NjzFcJUAcaEsbqTTAwGah37MYor57Vy97CCEx2',
    fermiAuthority:
      import.meta.env.VITE_FERMI_AUTHORITY || '8bHSuk6dpjquTw44vwr3sLukDSMLNkQLTcttGtC5pJtb',
  },
};

export const marketId = import.meta.env.VITE_MARKET_ID || '2a4b1a13-c18d-40f2-b387-d467474c30bf';
export const baseMint = new PublicKey(
  import.meta.env.VITE_BASE_MINT || 'fnUTeVwrsGgTHHLnr5x6ayDTJiuJbr9vNxi3SHoF5Gg'
);
export const quoteMint = new PublicKey(
  import.meta.env.VITE_QUOTE_MINT || 'Hf9KLE7pbHruArPXSVPn7sZ5iKt8Xxjmg2fCTzWUjEz8'
);

export const BASE_DECIMALS = 9;
export const QUOTE_DECIMALS = 6;

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
  markets: '/rollup/markets',
  market_by_id: '/rollup/markets/{marketId}',
  market_orderbook: '/rollup/markets/{marketId}/orderbook',
  market_orderbook_summary: '/rollup/markets/{marketId}/orderbook/summary',
  market_orderbook_depth: '/rollup/markets/{marketId}/depth',
  market_trades: '/rollup/markets/{marketId}/trades',
  market_funding: '/rollup/markets/{marketId}/funding',
  market_candles: '/rollup/markets/{marketId}/candles',
  user_orders: '/rollup/orders/user/{pubkey}',
  user_balances: '/rollup/balances/{pubkey}',
  user_accounts: '/rollup/accounts/{pubkey}',
  positions: '/rollup/positions',
  liquidations: '/rollup/liquidations',
  airdrop: '/rollup/airdrop',
  tx: '/continuum/tx',
};
