import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { useVaultClient } from '../useVaultProgram';
import { checkOrCreateAssociatedTokenAccount } from '@/solana/utils/helpers';
import ReactJson from 'react-json-view';
import { toast } from 'sonner';
import { PublicKey } from '@solana/web3.js';

export function GetVaultAndUserState() {
  const [userState, setUserState] = React.useState<object>({});
  const vaultClient = useVaultClient();
  const wallet = useAnchorWallet();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      if (!vaultClient) {
        throw new Error('Vault client not found');
        return;
      }
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // @ts-expect-error : e.target.tokenMint is not defined
      const tokenMint = new PublicKey(e.target.tokenMint.value);

      const userAta = await checkOrCreateAssociatedTokenAccount(
        vaultClient.provider,
        tokenMint,
        wallet.publicKey
      );

      console.log('got user ata', userAta);

      const vaultState = await vaultClient.getVaultState(tokenMint);
      const [vaultStatePda] = await vaultClient.getVaultStatePDA(tokenMint);
      const [vaultTokenAccount] = await vaultClient.getVaultTokenAccountPDA(vaultStatePda);

      const userState = await vaultClient.getUserState(userAta, vaultStatePda).catch(err => {
        toast.error('User state not found');
        console.error(err);
        return {};
      });

      setUserState({
        userState,
        vaultState,
        vaultTokenAccount: vaultTokenAccount.toBase58(),
        vaultStatePda: vaultStatePda.toBase58(),
        userAta: userAta.toBase58(),
      });
    } catch (err) {
      console.error(err);
      // @ts-expect-error : err is not defined
      toast.error(err?.message ?? 'Unknown error');
    }
  };

  return (
    <div className="border border-zinc-300 bg-white p-6 rounded-xl flex flex-col gap-3">
      <h1 className="text-xl ">Get Vault State</h1>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input className="flex-1 bg-zinc-100" name="tokenMint" placeholder="Token Mint Address" />
        <Button type="submit">Get Vault State</Button>
      </form>
      <div className="bg-zinc-100 rounded-xl p-3">
        <ReactJson src={userState} />
      </div>
    </div>
  );
}

export default GetVaultAndUserState;
