/**
 * PrivyWalletAdapter.ts
 * wallet-adapter shim over whichever Solana wallet the user logged in with via
 * Privy (embedded or external). The app keeps talking to `useWallet()` /
 * `useAnchorWallet()`; PrivyBridge feeds the active Privy wallet in through
 * `setSigner()`.
 */
import {
  BaseMessageSignerWalletAdapter,
  WalletDisconnectedError,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletReadyState,
  WalletSignMessageError,
  WalletSignTransactionError,
  type WalletName,
} from '@solana/wallet-adapter-base';
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  type TransactionVersion,
} from '@solana/web3.js';
import type { ConnectedStandardSolanaWallet } from '@privy-io/react-auth/solana';

export const PrivyWalletName = 'Privy' as WalletName<'Privy'>;

export function isEmbeddedWallet(wallet: ConnectedStandardSolanaWallet): boolean {
  return wallet.standardWallet.name === 'Privy';
}

/** The active Privy wallet, reduced to the byte-level operations the adapter needs. */
export interface PrivySigner {
  address: string;
  /** Underlying wallet name, e.g. "Privy" for embedded, "Phantom" for external. */
  walletName: string;
  isEmbedded: boolean;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  /** Takes and returns a serialized transaction (Privy's hooks are byte-only). */
  signTransaction: (serialized: Uint8Array) => Promise<Uint8Array>;
}

const ICON =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#185038"/><circle cx="16" cy="16" r="7" fill="#b4dc78"/></svg>'
  );

export class PrivyWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = PrivyWalletName;
  url = 'https://privy.io';
  icon = ICON;
  readonly supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set([
    'legacy',
    0,
  ] as TransactionVersion[]);

  private _signer: PrivySigner | null = null;
  private _publicKey: PublicKey | null = null;
  private _connecting = false;
  // Set while a user-initiated disconnect is waiting on Privy's logout, so the
  // bridge doesn't reconnect the still-present signer in the meantime.
  private _loggingOut = false;
  private _logout: (() => Promise<void>) | null = null;

  get publicKey() {
    return this._publicKey;
  }

  get connecting() {
    return this._connecting;
  }

  get readyState() {
    return WalletReadyState.Loadable;
  }

  /** Underlying wallet info for analytics / UI ("Privy" adapter name is not useful there). */
  get signer(): Readonly<Pick<PrivySigner, 'walletName' | 'isEmbedded'>> | null {
    return this._signer;
  }

  get canConnect() {
    return Boolean(this._signer) && !this._loggingOut;
  }

  setLogout(logout: () => Promise<void>) {
    this._logout = logout;
  }

  /** Called by PrivyBridge whenever the active Privy wallet changes. */
  setSigner(signer: PrivySigner | null) {
    const prev = this._signer;
    this._signer = signer;

    if (!signer) {
      this._loggingOut = false;
      if (this._publicKey) {
        this._publicKey = null;
        this.emit('disconnect');
      }
      return;
    }

    // Active wallet swapped while connected (e.g. user linked another wallet):
    // re-announce so wallet-adapter consumers pick up the new publicKey.
    if (this._publicKey && prev?.address !== signer.address) {
      this._publicKey = new PublicKey(signer.address);
      this.emit('connect', this._publicKey);
    }
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;
    if (!this.canConnect || !this._signer) throw new WalletNotReadyError();

    this._connecting = true;
    try {
      // PrivyBridge calls connect() in the same commit as select(), before
      // wallet-adapter-react has subscribed to this adapter's events. Emitting
      // synchronously would drop 'connect' and leave the adapter connected
      // while the app still sees it disconnected. Yield first, as a real
      // wallet's popup would.
      await new Promise(resolve => setTimeout(resolve, 0));
      if (!this.canConnect || !this._signer) throw new WalletNotReadyError();
      this._publicKey = new PublicKey(this._signer.address);
      this.emit('connect', this._publicKey);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    const wasConnected = Boolean(this._publicKey);
    this._publicKey = null;
    if (wasConnected) this.emit('disconnect');

    // Disconnecting the app wallet means ending the Privy session too.
    if (this._logout && this._signer) {
      this._loggingOut = true;
      try {
        await this._logout();
      } catch (error) {
        this._loggingOut = false;
        console.error('Privy logout failed:', error);
      }
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const signer = this.requireSigner();
    try {
      return await signer.signMessage(message);
    } catch (error: unknown) {
      const wrapped = new WalletSignMessageError(errorMessage(error), error);
      this.emit('error', wrapped);
      throw wrapped;
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    const signer = this.requireSigner();
    try {
      const isVersioned = transaction instanceof VersionedTransaction;
      const serialized = isVersioned
        ? transaction.serialize()
        : (transaction as Transaction).serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          });

      const signed = await signer.signTransaction(serialized);

      // Some sign-only external wallets return a bare 64-byte signature
      // instead of the full transaction; attach it to the original.
      if (signed.length === 64) {
        const signerKey = new PublicKey(signer.address);
        if (isVersioned) transaction.addSignature(signerKey, signed);
        else (transaction as Transaction).addSignature(signerKey, Buffer.from(signed));
        return transaction;
      }

      return (
        isVersioned ? VersionedTransaction.deserialize(signed) : Transaction.from(signed)
      ) as T;
    } catch (error: unknown) {
      const wrapped = new WalletSignTransactionError(errorMessage(error), error);
      this.emit('error', wrapped);
      throw wrapped;
    }
  }

  private requireSigner(): PrivySigner {
    if (!this._publicKey) throw new WalletNotConnectedError();
    if (!this._signer) throw new WalletDisconnectedError();
    return this._signer;
  }
}

// Single instance: PrivyBridge swaps the wallet behind it.
export const privyWalletAdapter = new PrivyWalletAdapter();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
