import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  checkOrCreateAssociatedTokenAccount,
  fetchTokenBalance,
  getAssociatedTokenAddress,
  mintTo,
} from '@/solana/utils/helpers';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useState } from 'react';
import ReactJson from 'react-json-view';
import { toast } from 'sonner';
import { useVaultClient } from '../useVaultProgram';

export function MintTokens() {
  // Inputs
  const [tokenAddress, setTokenAddress] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [tokenAmount, setTokenAmount] = useState(0);

  // States
  const [mintTx, setMintTx] = useState('');
  const [walletBalance, setWalletBalance] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ataAddress, setAtaAddress] = useState('');

  // Hooks
  const wallet = useAnchorWallet();
  const vaultClient = useVaultClient();
  const { connection } = useConnection();

  const fetchBalances = async (tokenMint: PublicKey) => {
    try {
      setIsLoading(true);
      if (!wallet) {
        throw new Error('Wallet not connected');
      }
      if (!connection) {
        throw new Error('Connection not found!');
      }

      const recipientPk = new PublicKey(recipientAddress);
      const associatedTokenAccount = await getAssociatedTokenAddress(tokenMint, recipientPk);
      setAtaAddress(associatedTokenAccount.toBase58());
      const fetchWalletBalance = await fetchTokenBalance(recipientPk, tokenMint, connection);

      setWalletBalance(fetchWalletBalance);
    } catch (err) {
      console.error(err);
      // @ts-expect-error : err is not defined
      toast.error(err?.message ?? 'Unknown error:: check console');
    }
    setIsLoading(false);
  };

  const mintTokens = async () => {
    try {
      setIsLoading(true);
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      if (!vaultClient) {
        throw new Error('Vault client not found');
      }

      if (!recipientAddress) {
        throw new Error('Recipient address not found');
      }

      if (!tokenAddress) {
        throw new Error('Token address not found');
      }

      const recipientAta = await checkOrCreateAssociatedTokenAccount(
        vaultClient.provider,
        new PublicKey(tokenAddress),
        new PublicKey(recipientAddress)
      );
      setAtaAddress(recipientAta.toBase58());
      const mintTx = await mintTo(
        vaultClient.provider,
        new PublicKey(tokenAddress),
        recipientAta,
        BigInt(tokenAmount * 10 ** 9)
      );

      setMintTx(mintTx);
    } catch (err) {
      console.error(err);
      // @ts-expect-error : err is not defined
      toast.error(err?.message ?? 'Unknown error:: check console');
    }
    setIsLoading(false);
  };

  return (
    <div className="border border-zinc-300 bg-white p-6 rounded-xl flex flex-col gap-3">
      <h1>Airdrop tokens </h1>
      <div className="flex flex-col gap-3 flex-wrap">
        <div className="gap-3 flex flex-wrap">
          <Input
            className="flex-1 bg-zinc-100"
            name="tokenMintAddress"
            value={tokenAddress}
            onChange={e => setTokenAddress(e.target.value)}
            placeholder="Enter token mint address"
          />
          <Input
            className="flex-1 bg-zinc-100"
            name="recipientAddress"
            value={recipientAddress}
            onChange={e => setRecipientAddress(e.target.value)}
            placeholder="Enter recipient address"
          />
          <Input
            className="flex-1 bg-zinc-100"
            name="tokenAmount"
            value={tokenAmount}
            onChange={e => setTokenAmount(Number(e.target.value))}
            placeholder="Enter token amount"
          />
          <Button disabled={isLoading} onClick={() => fetchBalances(new PublicKey(tokenAddress))}>
            Fetch Balances
          </Button>
          <Button disabled={isLoading} onClick={mintTokens}>
            Mint Tokens
          </Button>
        </div>
        <ReactJson src={{ walletBalance, tokenAddress, ataAddress, mintTx }} />
      </div>
    </div>
  );
}

export default MintTokens;
