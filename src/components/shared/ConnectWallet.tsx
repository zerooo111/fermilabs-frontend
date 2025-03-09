/**
 * ConnectWallet.tsx
 * A custom button component that handles wallet connection and displays wallet status
 * Uses Solana wallet adapter hooks for wallet interaction
 */

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useCallback, useMemo, useState } from 'react';
import { Copy, LogOut, Wallet } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import Button from '@/components/ui/Button';

const LABELS = {
  'copy-address': 'Copy address',
  copied: 'Copied',
  'change-wallet': 'Change wallet',
  disconnect: 'Disconnect',
  connecting: 'Connecting...',
  'no-wallet': 'Select Wallet',
  'has-wallet': 'Connect',
} as const;

/**
 * Custom wallet connection button component
 * Handles wallet selection and connection state
 */
export function ConnectWallet() {
  const { wallet, disconnect, connected, connecting, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [copied, setCopied] = useState(false);

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
    if (wallet) return LABELS['has-wallet'];
    return LABELS['no-wallet'];
  }, [connecting, publicKey, wallet]);

  const baseButton = (
    <Button
      variant="default"
      onClick={() => {
        if (!connected) {
          setVisible(true);
        }
      }}
      disabled={connecting}
      loading={connecting}
    >
      {connected && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
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
        <DropdownMenuItem onClick={disconnect} className="text-red-600">
          <LogOut className="size-4" />
          {LABELS['disconnect']}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
