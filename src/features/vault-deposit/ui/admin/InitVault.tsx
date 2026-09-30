import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Input } from '../../../../shared/ui/input';
import { Button } from '../../../../shared/ui/button';
import { useVaultClient } from '../../lib/useVaultProgram';

export function InitVaultFlow() {
  const [error, setError] = useState('');
  const vaultClient = useVaultClient();
  // const [isLoading, setIsLoading] = useState(false);
  const [txn, setTxn] = useState('');
  const [vaultData, setVaultData] = useState<object>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    try {
      if (!vaultClient) throw new Error('Vault client not found');
      setError('');
      setTxn('');
      e.preventDefault();
      // @ts-expect-error : e.target.tokenMintAddress is not defined
      const tokenMintAddress = e.target.tokenMintAddress.value;
      const tokenMint = new PublicKey(tokenMintAddress);
      const { txid, ...rest } = await vaultClient.createVault(tokenMint);
      setTxn(txid);
      setVaultData(rest);
    } catch (err) {
      // Silent error handling
      // @ts-expect-error : err is not defined
      setError(err.message);
    }
  };

  return (
    <div className="border border-line bg-surface-base text-fg-primary p-6 flex flex-col gap-3">
      <h1 className="text-xl">Init Vault</h1>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          className="flex-1 bg-surface-sunken"
          name="tokenMintAddress"
          placeholder="Token Mint Address"
        />
        <Button type="submit">Init Vault</Button>
      </form>
      {txn && (
        <a
          href={`https://explorer.solana.com/tx/${txn}`}
          target="_blank"
          rel="noreferrer"
          className="text-info-fg outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          View Transaction on Solana Explorer
        </a>
      )}
      {error && <div className="text-negative-fg font-mono font-medium">{error}</div>}
      <div className="bg-surface-sunken p-3 text-fg-secondary">
        <pre>{JSON.stringify(vaultData, null, 2)}</pre>
      </div>
    </div>
  );
}
