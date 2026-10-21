/**
 * PrivyBridge.tsx
 * Mirrors the active Privy Solana wallet into the wallet-adapter context:
 * Privy login → adapter selected + connected; Privy logout → adapter disconnected.
 * Only wallets linked to the logged-in Privy user count: switching to another
 * account in the wallet extension logs out, so the next login starts clean.
 * Renders nothing; mount once inside both PrivyProvider and WalletProvider.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
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

  // Solana wallets linked to the logged-in Privy user. A connected wallet
  // outside this set (the user switched accounts in the extension) isn't the
  // one Privy authenticated, so it must not be used under this session.
  const linked = useMemo(
    () =>
      new Set(
        (user?.linkedAccounts ?? []).flatMap(a =>
          a.type === 'wallet' && a.chainType === 'solana' ? [a.address] : []
        )
      ),
    [user?.linkedAccounts]
  );

  const usable = useMemo(
    () => (embeddedWalletsEnabled ? wallets : wallets.filter(w => !isEmbeddedWallet(w))),
    [wallets]
  );

  // Prefer the wallet the user logged in with, then their embedded wallet.
  // With embedded wallets disabled, sessions from an earlier email/social
  // login stay disconnected until the user connects a regular wallet.
  const active = useMemo(() => {
    if (!ready || !authenticated) return null;
    const own = usable.filter(w => isEmbeddedWallet(w) || linked.has(w.address));
    const primary = user?.wallet?.address;
    return own.find(w => w.address === primary) ?? own.find(isEmbeddedWallet) ?? own[0] ?? null;
  }, [ready, authenticated, user?.wallet?.address, usable, linked]);

  // Logging out also drops Privy's connections to external wallets, so the
  // next login connects afresh and reads the extension's current account. A
  // kept connection can hold the previous account, and Privy then fails to
  // verify the login signature ("Could not log in with wallet").
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

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

  const logoutAll = useCallback(async () => {
    const external = walletsRef.current.filter(w => !isEmbeddedWallet(w));
    await Promise.allSettled(external.map(w => w.disconnect()));
    await logout();
  }, [logout]);

  useEffect(() => {
    adapter.setLogout(logoutAll);
  }, [adapter, logoutAll]);

  // The extension switched to an account this Privy user didn't log in with:
  // end the session (and our app connection) instead of carrying on with a
  // wallet Privy never verified.
  const switched =
    ready &&
    authenticated &&
    !!user &&
    !active &&
    usable.some(w => !isEmbeddedWallet(w) && !linked.has(w.address));
  useEffect(() => {
    if (!switched) return;
    toast('Wallet account changed. Connect again to continue.');
    logoutAll().catch(error => console.error('Privy logout failed:', error));
  }, [switched, logoutAll]);

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
