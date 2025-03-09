import { useState } from 'react';
import { useVaultProgram } from '../useVaultProgram';
import { PublicKey } from '@solana/web3.js';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ReactJson from 'react-json-view';

export function InitVaultFlow() {
  const [error, setError] = useState('');
  const { createVault } = useVaultProgram();
  const [isLoading, setIsLoading] = useState(false);
  const [txn, setTxn] = useState('');
  const [vaultData, setVaultData] = useState<object>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    try {
      setError('');
      setTxn('');
      e.preventDefault();
      setIsLoading(true);
      const tokenMintAddress = e.target.tokenMintAddress.value;
      const tokenMint = new PublicKey(tokenMintAddress);
      const { txid, ...rest } = await createVault(tokenMint);
      setTxn(txid);
      setVaultData(rest);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-zinc-300 bg-white p-6 rounded-xl flex flex-col gap-3">
      <h1 className="text-xl">Init Vault</h1>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          className="flex-1 bg-zinc-100"
          name="tokenMintAddress"
          placeholder="Token Mint Address"
        />
        <Button type="submit" loading={isLoading}>
          Init Vault
        </Button>
      </form>
      {txn && (
        <a
          href={`https://explorer.solana.com/tx/${txn}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-500"
        >
          View Transaction on Solana Explorer
        </a>
      )}
      {error && <div className="text-red-500 font-mono font-medium">{error}</div>}
      <div className="bg-zinc-100 rounded-xl p-3">
        <ReactJson src={{ ...vaultData }} />
      </div>
    </div>
  );
}

export default InitVaultFlow;
