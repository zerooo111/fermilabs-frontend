export const RPC_URL = {
  devnet: 'https://api.devnet.solana.com',
};

// config -> network ( devnet / mainnet ) -> programId / rpcUrl , commitment , etc...
export const config = {
  devnet: {
    programId: 'DrgsHv79i7B9YBW5jNcgQmXWHvur3MbRGKrbCauBm79z',
    rpcUrl: 'https://api.devnet.solana.com',
    commitment: 'confirmed',
    wsUrl: 'wss://api.devnet.solana.com',
  },
};

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
