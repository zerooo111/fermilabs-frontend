/**
 * ConnectWallet.tsx
 * A button component that handles wallet connection and displays wallet status
 * Uses Solana wallet adapter hooks for wallet interaction
 */

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useMemo } from 'react';

export function ConnectWallet() {
  const { wallet, connected } = useWallet();

  const buttonLabel = useMemo(() => {
    if (!wallet) return 'Connect Wallet';
    if (connected) return 'Connected';
    return 'Connect';
  }, [wallet, connected]);

  return (
    <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !rounded-lg !h-10">
      {buttonLabel}
    </WalletMultiButton>
  );
}
