import { PublicKey } from '@solana/web3.js';

export const RPC_URL = {
  devnet: 'https://api.devnet.solana.com',
};

// config -> network ( devnet / mainnet ) -> programId / rpcUrl , commitment , etc...
export const config = {
  devnet: {
    programId: '3LaFxgsYSc27YuEhY7CwkfGyvpcAinmiHcAA5qE399ob',
    rpcUrl: 'https://api.devnet.solana.com',
    commitment: 'confirmed',
    wsUrl: 'wss://api.devnet.solana.com',
    defaultMarketAddress: 'GnDethiMd2Z1ANCeSAcP7fxRWXL64FM6dNJowho6Knxt',
    vaultProgramId: 'CVB232NjzFcJUAcaEsbqTTAwGah37MYor57Vy97CCEx2',
    fermiAuthority: '8bHSuk6dpjquTw44vwr3sLukDSMLNkQLTcttGtC5pJtb',
  },
};

export const baseMint = new PublicKey('C76ZBodamZSgSNacHRh5r5Z6yUHoNzQzPFuv6sbkWVP3');
export const quoteMint = new PublicKey('BoeLKGVE3LcLgqptbdKgUG9Qn22KbqfEUKKH52uR44dm');

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
