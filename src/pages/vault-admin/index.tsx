/**
 * Vault Admin page
 * Administrative interface for the vault
 */
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import { Button } from '../../shared/ui/button';

import {
  GetVaultAndUserState,
  InitVaultFlow,
  CreateTokenMintFlow,
  MintTokens,
  Notepad,
} from '../../features/vault-deposit';

function VaultAdminPage() {
  const wallet = useAnchorWallet();

  const createMarket = async () => {
    try {
      const response = await axios.post('http://54.196.30.137:8082/markets', {
        base_mint: 'fnUTeVwrsGgTHHLnr5x6ayDTJiuJbr9vNxi3SHoF5Gg',
        quote_mint: 'Hf9KLE7pbHruArPXSVPn7sZ5iKt8Xxjmg2fCTzWUjEz8',
        name: 'TEST/USDC',
      });
      console.log(response);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex-1 bg-zinc-100 p-6">
      <div className="flex flex-col gap-4">
        {wallet ? (
          <>
            <Button onClick={createMarket}>Create Market</Button>
            <Notepad />
            <CreateTokenMintFlow />
            <MintTokens />
            <InitVaultFlow />
            <GetVaultAndUserState />
            {/* <DepositTokens /> */}
            {/* <WithdrawTokens /> */}
          </>
        ) : (
          <div className="text-zinc-500">Connect your wallet to continue</div>
        )}
      </div>
    </div>
  );
}

export default VaultAdminPage;
