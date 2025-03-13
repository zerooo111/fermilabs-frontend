import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { GetVaultAndUserState } from './admin/GetVaultAndUserState';
import InitVaultFlow from './admin/InitVault';
import CreateTokenMintFlow from './admin/CreateTokenMint';
import MintTokens from './admin/MintTokens';
import DepositTokens from './admin/DepositTokens';
import WithdrawTokens from './admin/WithdrawTokens';
import Notepad from './admin/Notepad';

export function VaultAdminPage() {
  const wallet = useAnchorWallet();

  return (
    <div className="flex-1 bg-zinc-100 p-6">
      <div className="flex flex-col gap-4">
        {wallet ? (
          <>
            <Notepad />
            <CreateTokenMintFlow />
            <MintTokens />
            <InitVaultFlow />
            <GetVaultAndUserState />
            <DepositTokens />
            <WithdrawTokens />
          </>
        ) : (
          <div className="text-zinc-500">Connect your wallet to continue</div>
        )}
      </div>
    </div>
  );
}
