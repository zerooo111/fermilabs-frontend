/**
 * ConnectWallet.tsx
 * A custom button component that handles wallet connection and displays wallet status
 * Wallet state comes from wallet-adapter, backed by the active Privy wallet
 */

import { useWallet } from '@solana/wallet-adapter-react';
import { useSetAtom } from 'jotai';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { Copy, KeyRound, LogOut, Wallet } from 'lucide-react';
import posthog from 'posthog-js';
import { useServerConfig } from '@/entities/server';
import { useActiveWalletInfo } from '@/entities/wallet';
import { gateOpenAtom, accessSessionAtom, clearSession } from '@/features/access-gate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu';
import { Button } from '../../../shared/ui/button';

const LABELS = {
  'copy-address': 'Copy address',
  copied: 'Copied',
  'change-wallet': 'Change wallet',
  'export-wallet': 'Export private key',
  disconnect: 'Disconnect',
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
  const setGateOpen = useSetAtom(gateOpenAtom);
  const setSession = useSetAtom(accessSessionAtom);
  const [copied, setCopied] = useState(false);
  useServerConfig();

  // Identify user and capture wallet_connected when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      const walletAddress = publicKey.toBase58();
      posthog.identify(walletAddress, {
        wallet_address: walletAddress,
        wallet_name: walletName,
        wallet_embedded: isEmbedded,
      });
      posthog.capture('wallet_connected', {
        wallet_address: walletAddress,
        wallet_name: walletName,
        wallet_embedded: isEmbedded,
      });
    }
  }, [connected, publicKey, walletName, isEmbedded]);

  // Handle copy address
  const handleCopyAddress = useCallback(async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 400);
    }
  }, [publicKey]);

  // Button content based on connection state
  const buttonContent = useMemo(() => {
    if (publicKey) {
      return `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;
    }
    if (connecting) return LABELS['connecting'];
    return LABELS['connect'];
  }, [connecting, publicKey]);

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

  const baseButton = (
    <Button variant="default" size="sm" onClick={handleConnectClick}>
      {connected && <div className="w-2 h-2 bg-green-400 animate-pulse" />}
      {buttonContent}
    </Button>
  );

  if (!connected) {
    return baseButton;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{baseButton}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleCopyAddress}>
          <Copy className="size-4" />
          {copied ? LABELS['copied'] : LABELS['copy-address']}
        </DropdownMenuItem>
        {isEmbedded && (
          <DropdownMenuItem onClick={handleExportWallet}>
            <KeyRound className="size-4" />
            {LABELS['export-wallet']}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleChangeWallet}>
          <Wallet className="size-4" />
          {LABELS['change-wallet']}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDisconnect} className="text-red-600">
          <LogOut className="size-4" />
          {LABELS['disconnect']}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
