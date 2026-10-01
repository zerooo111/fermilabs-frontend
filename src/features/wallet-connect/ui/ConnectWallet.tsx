/**
 * ConnectWallet.tsx
 * A custom button component that handles wallet connection and displays wallet status
 * Wallet state comes from wallet-adapter, backed by the active Privy wallet
 */

import { useWallet } from '@solana/wallet-adapter-react';
import { useSetAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import posthog from 'posthog-js';
import { useServerConfig } from '@/entities/server';
import { useAccountIdentity, useActiveWalletInfo } from '@/entities/wallet';
import { gateOpenAtom, accessSessionAtom, clearSession } from '@/features/access-gate';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Button } from '@/shared/ui/button';
import { AccountAvatar } from './AccountAvatar';
import { AccountMenuContent } from './AccountMenu';

const LABELS = {
  connecting: 'Connecting...',
  connect: 'Connect Wallet',
} as const;

/**
 * Custom wallet connection button component
 * Handles wallet selection and connection state
 */
export function ConnectWallet() {
  const { disconnect, connected, connecting, publicKey } = useWallet();
  const { walletName, isEmbedded, exportWallet } = useActiveWalletInfo();
  const identity = useAccountIdentity();
  const loginMethod = identity?.method ?? null;
  const setGateOpen = useSetAtom(gateOpenAtom);
  const setSession = useSetAtom(accessSessionAtom);
  useServerConfig();

  // Identify user and capture wallet_connected when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      const walletAddress = publicKey.toBase58();
      // Only the login method, never the email/handle, goes to analytics.
      posthog.identify(walletAddress, {
        wallet_address: walletAddress,
        wallet_name: walletName,
        wallet_embedded: isEmbedded,
        login_method: loginMethod,
      });
      posthog.capture('wallet_connected', {
        wallet_address: walletAddress,
        wallet_name: walletName,
        wallet_embedded: isEmbedded,
        login_method: loginMethod,
      });
    }
  }, [connected, publicKey, walletName, isEmbedded, loginMethod]);

  // Unconnected click defers to the access gate so wallet selection and
  // invite-code redemption happen in a single unified modal flow.
  const handleConnectClick = useCallback(() => {
    if (connected || connecting) return;
    setGateOpen(true);
  }, [connected, connecting, setGateOpen]);

  // Explicit disconnect = full logout: drop the cached session token so a
  // subsequent reconnect re-prompts via the gate instead of silently
  // restoring the previous session.
  const handleDisconnect = useCallback(async () => {
    const walletAddress = publicKey?.toBase58();
    posthog.capture('wallet_disconnected', {
      wallet_address: walletAddress,
      wallet_name: walletName,
      wallet_embedded: isEmbedded,
    });
    posthog.reset();
    if (walletAddress) {
      clearSession(walletAddress);
      setSession(prev => {
        const { [walletAddress]: _, ...rest } = prev;
        return rest;
      });
    }
    try {
      await disconnect();
    } catch (err) {
      console.error('Wallet disconnect failed:', err);
    }
  }, [publicKey, walletName, isEmbedded, disconnect, setSession]);

  // Logging out ends the Privy session, so switching wallets is logout → gate.
  const handleChangeWallet = useCallback(async () => {
    await handleDisconnect();
    setGateOpen(true);
  }, [handleDisconnect, setGateOpen]);

  const handleExportWallet = useCallback(() => {
    exportWallet().catch(err => console.error('Wallet export failed:', err));
  }, [exportWallet]);

  if (!connected || !publicKey) {
    return (
      <Button variant="default" size="sm" onClick={handleConnectClick}>
        {connecting ? LABELS['connecting'] : LABELS['connect']}
      </Button>
    );
  }

  const address = publicKey.toBase58();
  const showIdentity = identity && identity.method !== 'wallet';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="gap-2 pl-1"
          aria-label={`Account menu${showIdentity ? `, ${identity.label}` : ''}`}
        >
          <AccountAvatar address={address} avatarUrl={identity?.avatarUrl} className="size-6" />
          {showIdentity && (
            <>
              <span className="hidden max-w-36 truncate lg:inline">{identity.label}</span>
              <span className="hidden h-3 w-px bg-background/25 lg:block" aria-hidden />
            </>
          )}
          <span className="font-mono text-[11px] tracking-tight text-background/80">
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <AccountMenuContent
        address={address}
        identity={identity}
        onExportWallet={handleExportWallet}
        onSwitchAccount={handleChangeWallet}
        onLogOut={handleDisconnect}
      />
    </DropdownMenu>
  );
}
