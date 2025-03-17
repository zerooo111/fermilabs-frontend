import { useState } from 'react';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { createMint } from '@/solana/utils/helpers';
import Copyable from '@/components/shared/Copyable';
import { Button } from '@/components/ui/button';
import { PublicKey } from '@solana/web3.js';
import { useVaultClient } from '../useVaultProgram';

export function CreateTokenMintFlow() {
  const [tokenMint, setTokenMint] = useState<PublicKey | null>(null);
  const [tokenMintTx, setTokenMintTx] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const vaultClient = useVaultClient();
  const wallet = useAnchorWallet();

  const handleCreateMint = async () => {
    try {
      if (!vaultClient) {
        throw new Error('Vault client not found');
      }
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      setIsLoading(true);
      // Create Mint
      const { signature, mintAddress } = await createMint(vaultClient.provider, 9);
      setTokenMint(mintAddress);
      setTokenMintTx(signature);
    } catch (err) {
      console.error(err);
      // @ts-expect-error : err is not defined
      toast.error(err?.message ?? 'Failed to create mint');
    } finally {
      setIsLoading(false);
    }
  };
  // Create a new token mint
  // mint tokens to the keypair

  return (
    <div className="border border-zinc-300 bg-white p-6 rounded-xl flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl">Create Token Mint</h1>
        <Button onClick={handleCreateMint}>Create Mint</Button>
      </div>
      {tokenMint && (
        <Copyable textToCopy={tokenMint.toBase58()} className="flex gap-2 hover:text-blue-500">
          {' '}
          Token Mint: {tokenMint.toBase58()} <Copyable.Icon />{' '}
        </Copyable>
      )}
      {tokenMintTx && (
        <a
          href={`https://explorer.solana.com/tx/${tokenMintTx}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-500"
        >
          View Transaction on Solan Explorer
        </a>
      )}
      <hr className="w-full border-zinc-300" />
    </div>
  );
}

export default CreateTokenMintFlow;
