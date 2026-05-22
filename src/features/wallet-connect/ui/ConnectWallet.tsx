/**
 * ConnectWallet.tsx
 * A custom button component that handles wallet connection and displays wallet status
 * Uses Solana wallet adapter hooks for wallet interaction
 */

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useSetAtom } from 'jotai';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { Copy, LogOut, Wallet } from 'lucide-react';
import posthog from 'posthog-js';
import { useServerConfig } from '@/entities/server';
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
  disconnect: 'Disconnect',
  connecting: 'Connecting...',
  connect: 'Connect Wallet',
} as const;

/**
 * Custom wallet connection button component
 * Handles wallet selection and connection state
 */
export function ConnectWallet() {
  const { wallet, disconnect, connected, connecting, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
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
        wallet_name: wallet?.adapter?.name,
      });
      posthog.capture('wallet_connected', {
        wallet_address: walletAddress,
        wallet_name: wallet?.adapter?.name,
      });
    }
  }, [connected, publicKey, wallet]);

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
      wallet_name: wallet?.adapter?.name,
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
  }, [publicKey, wallet, disconnect, setSession]);

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
        <DropdownMenuItem onClick={() => setVisible(true)}>
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
