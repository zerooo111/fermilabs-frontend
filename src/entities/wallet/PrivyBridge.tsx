/**
 * PrivyBridge.tsx
 * Mirrors the active Privy Solana wallet into the wallet-adapter context:
 * Privy login → adapter selected + connected; Privy logout → adapter disconnected.
 * Renders nothing; mount once inside both PrivyProvider and WalletProvider.
 */
import { useEffect, useMemo, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSignMessage, useSignTransaction, useWallets } from '@privy-io/react-auth/solana';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  PrivyWalletName,
  isEmbeddedWallet,
  type PrivySigner,
  type PrivyWalletAdapter,
} from './PrivyWalletAdapter';
import { embeddedWalletsEnabled, privyChain } from './privyConfig';

export function PrivyBridge({ adapter }: { adapter: PrivyWalletAdapter }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const { signTransaction } = useSignTransaction();
  const { wallet: selected, select, connect, connected, connecting } = useWallet();

  // Privy's hook functions aren't guaranteed stable; keep the latest in refs so
  // the signer object only changes when the active wallet does.
  const signMessageRef = useRef(signMessage);
  const signTransactionRef = useRef(signTransaction);
  signMessageRef.current = signMessage;
  signTransactionRef.current = signTransaction;

  // Prefer the wallet the user logged in with, then their embedded wallet.
  // With embedded wallets disabled, sessions from an earlier email/social
  // login stay disconnected until the user connects a regular wallet.
  const active = useMemo(() => {
    if (!ready || !authenticated) return null;
    const usable = embeddedWalletsEnabled ? wallets : wallets.filter(w => !isEmbeddedWallet(w));
    const primary = user?.wallet?.address;
    return (
      usable.find(w => w.address === primary) ?? usable.find(isEmbeddedWallet) ?? usable[0] ?? null
    );
  }, [ready, authenticated, user?.wallet?.address, wallets]);

  const signer = useMemo<PrivySigner | null>(() => {
    if (!active) return null;
    return {
      address: active.address,
      walletName: active.standardWallet.name,
      walletIcon: active.standardWallet.icon ?? null,
      isEmbedded: isEmbeddedWallet(active),
      // Message signing backs the access-gate challenge and every order intent,
      // so skip Privy's confirmation modal (external wallets still prompt natively).
      signMessage: async message => {
        const { signature } = await signMessageRef.current({
          message,
          wallet: active,
          options: { uiOptions: { showWalletUIs: false } },
        });
        return signature;
      },
      // Transactions move funds — keep Privy's confirmation modal.
      signTransaction: async transaction => {
        const { signedTransaction } = await signTransactionRef.current({
          transaction,
          wallet: active,
          chain: privyChain,
        });
        return signedTransaction;
      },
    };
  }, [active]);

  useEffect(() => {
    adapter.setLogout(logout);
  }, [adapter, logout]);

  useEffect(() => {
    adapter.setSigner(signer);
  }, [adapter, signer]);

  useEffect(() => {
    if (!signer) return;
    if (selected?.adapter.name !== PrivyWalletName) {
      select(PrivyWalletName);
      return;
    }
    if (connected || connecting || !adapter.canConnect) return;
    connect().catch(error => console.error('Privy wallet connect failed:', error));
  }, [adapter, signer, selected, select, connect, connected, connecting]);

  return null;
}
