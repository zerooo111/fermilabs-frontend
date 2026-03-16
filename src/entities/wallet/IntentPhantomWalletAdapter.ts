import {
  WalletError,
  WalletNotConnectedError,
  WalletSignMessageError,
} from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

type PhantomSignMessageResult = {
  signature?: Uint8Array;
};

// Phantom wallet-adapter signs messages without explicitly setting display mode.
// Queue intent messages are binary hashes; use "hex" display to avoid provider rejection.
export class IntentPhantomWalletAdapter extends PhantomWalletAdapter {
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      const wallet = (this as any)._wallet as
        | {
            signMessage?: (
              data: Uint8Array,
              display?: 'hex' | 'utf8'
            ) => Promise<PhantomSignMessageResult>;
          }
        | null
        | undefined;

      if (!wallet?.signMessage) {
        throw new WalletNotConnectedError();
      }

      try {
        const signed = await wallet.signMessage(message, 'hex');
        if (signed?.signature instanceof Uint8Array) {
          return signed.signature;
        }
      } catch (error: unknown) {
        try {
          const signed = await wallet.signMessage(message, 'utf8');
          if (signed?.signature instanceof Uint8Array) {
            return signed.signature;
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

      throw new WalletSignMessageError('Phantom returned an invalid message signature');
    } catch (error: unknown) {
      this.emit('error', error as Error);
      throw error;
    }
  }
}
