import { useState } from 'react';
import { toast } from 'sonner';
import { useVaultClient } from '../useVaultProgram';
import { checkOrCreateAssociatedTokenAccount } from '@/solana/utils/helpers';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function DepositTokens() {
  const [depositAmount, setDepositAmount] = useState(0);
  const [tokenMintAddress, setTokenMintAddress] = useState('');
  const vaultClient = useVaultClient();
  const [depositTx, setDepositTx] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDeposit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!vaultClient) {
        throw new Error('Vault client not found');
      }

      const tokenMint = new PublicKey(tokenMintAddress);
      const userPk = vaultClient.walletPk;
      const provider = vaultClient.provider;
      console.log('provider', provider);
      console.log('userPk', userPk);
      console.log('tokenMint', tokenMint);
      const userTokenAccount = await checkOrCreateAssociatedTokenAccount(
        provider,
        tokenMint,
        userPk
      );
      console.log('userTokenAccount', userTokenAccount);

      const depositTx = await vaultClient.deposit(
        new BN(depositAmount),
        tokenMint,
        userTokenAccount,
        userPk
      );

      setDepositTx(depositTx);
    } catch (err) {
      console.error(err);
      // @ts-expect-error : err is not defined
      toast.error(err?.message ?? 'Check console for eror');
    }
    setIsLoading(false);
  };

  return (
    <div className="border border-zinc-300 bg-white p-6 rounded-xl flex flex-col gap-3">
      <h1>Deposit Tokens</h1>
      <form className="flex gap-3" onSubmit={handleDeposit}>
        <Input
          className="flex-1 bg-zinc-100"
          type="number"
          min={0}
          required
          onChange={e => setDepositAmount(Number(e.target.value))}
          placeholder="Enter Deposit Amount"
        />
        <Input
          className="flex-1 bg-zinc-100"
          type="text"
          required
          onChange={e => setTokenMintAddress(e.target.value)}
          placeholder="Enter Token Mint Address"
        />
        <Button type="submit" disabled={!depositAmount || !tokenMintAddress || isLoading}>
          Deposit
        </Button>
      </form>
      {depositTx && (
        <a
          href={`https://explorer.solana.com/tx/${depositTx}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-500"
        >
          View Transaction on Solana Explorer
        </a>
      )}
    </div>
  );
}

export default DepositTokens;
