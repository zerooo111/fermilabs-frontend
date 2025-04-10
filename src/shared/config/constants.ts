/**
 * Application constants
 */
import { PublicKey } from '@solana/web3.js';

// config -> network ( devnet / mainnet ) -> programId / rpcUrl , commitment , etc...
export const config = {
  devnet: {
    globalSequencerApiUrl: 'https://13.203.79.139:8084',
    graphApiUrl: 'https://18.132.52.205',
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
