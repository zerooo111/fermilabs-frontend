/**
 * Application constants
 */
import { PublicKey } from '@solana/web3.js';

// config -> network ( devnet / mainnet ) -> programId / rpcUrl , commitment , etc...
export const config = {
  devnet: {
    globalSequencerApiUrl: 'https://glbsq1.fermilabs.xyz',
    graphApiUrl: 'https://graphapi1.fermilabs.xyz/v1',
    rpcUrl: 'https://api.devnet.solana.com',
    commitment: 'confirmed',
    wsUrl: 'wss://api.devnet.solana.com',
    defaultMarketAddress: 'GnDethiMd2Z1ANCeSAcP7fxRWXL64FM6dNJowho6Knxt',
    vaultProgramId: 'CVB232NjzFcJUAcaEsbqTTAwGah37MYor57Vy97CCEx2',
    fermiAuthority: '8bHSuk6dpjquTw44vwr3sLukDSMLNkQLTcttGtC5pJtb',
  },
};

export const marketId = '2a4b1a13-c18d-40f2-b387-d467474c30bf';
export const baseMint = new PublicKey('fnUTeVwrsGgTHHLnr5x6ayDTJiuJbr9vNxi3SHoF5Gg');
export const quoteMint = new PublicKey('Hf9KLE7pbHruArPXSVPn7sZ5iKt8Xxjmg2fCTzWUjEz8');

export const BASE_DECIMALS = 9;
export const QUOTE_DECIMALS = 9;

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
