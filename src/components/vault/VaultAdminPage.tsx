// Create Token Mint
// Init Vault ( token Mint )
// Airdrop Token vault ( mintTo )

import { useAnchorWallet } from '@solana/wallet-adapter-react';
import Button from '../ui/Button';
import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useVaultProgram } from './useVaultProgram';
import { toast } from 'sonner';
import Copyable from '../shared/Copyable';
import { GetVaultAndUserState } from './admin/GetVaultAndUserState';
import InitVaultFlow from './admin/InitVault';
import CreateTokenMintFlow from './admin/CreateTokenMint';

export function VaultAdminPage() {
  const wallet = useAnchorWallet();

  return (
    <div className="flex-1 bg-zinc-100 p-6">
      <div className="flex flex-col gap-4">
        {wallet ? (
          <>
            <InitVaultFlow />
            <GetVaultAndUserState />
            <CreateTokenMintFlow />
          </>
        ) : (
          <div className="text-zinc-500">Connect your wallet to continue</div>
        )}
      </div>
    </div>
  );
}
