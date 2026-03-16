import {
  WalletError,
  WalletNotConnectedError,
  WalletSignMessageError,
} from '@solana/wallet-adapter-base';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

// Solflare's default wallet-adapter path signs messages with "utf8" display.
// Execution-queue intent messages are binary hashes and should be signed as hex.
export class IntentSolflareWalletAdapter extends SolflareWalletAdapter {
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      const wallet = (this as any)._wallet as
        | {
            signMessage?: (data: Uint8Array, display?: 'hex' | 'utf8') => Promise<Uint8Array>;
            sign?: (data: Uint8Array, display?: 'hex' | 'utf8') => Promise<Uint8Array>;
          }
        | null
        | undefined;

      if (!wallet) {
        throw new WalletNotConnectedError();
      }

      try {
        if (typeof wallet.signMessage === 'function') {
          return await wallet.signMessage(message, 'hex');
        }
        if (typeof wallet.sign === 'function') {
          return await wallet.sign(message, 'hex');
        }
      } catch (error: unknown) {
        // Fallback to utf8 only if hex path fails for an unexpected wallet implementation.
        try {
          if (typeof wallet.signMessage === 'function') {
            return await wallet.signMessage(message, 'utf8');
          }
        } catch {
          // handled below
        }

        if (error instanceof WalletError) {
          throw error;
        }
        throw new WalletSignMessageError(
          error instanceof Error ? error.message : String(error),
          error
        );
      }

      return await super.signMessage(message);
    } catch (error: unknown) {
      this.emit('error', error as Error);
      throw error;
    }
  }
}
