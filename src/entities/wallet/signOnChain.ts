/**
 * Sign a transaction for a given Solana chain with the connected Privy wallet.
 * wallet-adapter's `signTransaction` always uses the app's trading chain; a
 * feature on another network (the FLP vault on devnet) signs through this, so
 * the wallet simulates and shows the transaction on the network it runs on.
 */
import type { Transaction, VersionedTransaction } from '@solana/web3.js';

import { privyWalletAdapter } from './PrivyWalletAdapter';
import type { SolanaChain } from './privyConfig';

export function signTransactionOn<T extends Transaction | VersionedTransaction>(
  transaction: T,
  chain: SolanaChain
): Promise<T> {
  return privyWalletAdapter.signTransactionOn(transaction, chain);
}
