import { config } from '@/solana/constants';
import { LiquidityVaultClient } from '@/solana/vault_client';
import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

export function useVaultProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
  }, [connection, wallet]);

  const vaultClient = useMemo(() => {
    if (!provider) return;

    return new LiquidityVaultClient(provider, new PublicKey(config.devnet.vaultProgramId), {
      postSendTxCallback: ({ txid }) => {
        console.log('--------------------------------');
        console.log('txid:', txid);
        console.log('Solana Explorer:', `https://explorer.solana.com/tx/${txid}?cluster=devnet`);
        console.log('--------------------------------');

        toast.custom(() => (
          <div className="bg-white border border-zinc-300 shadow-2xl p-3 rounded-xl flex flex-col gap-2 text-xs">
            <p className="font-semibold">Transaction sent successfully</p>
            <a
              className="text-blue-500 underline flex items-center gap-1"
              href={`https://explorer.solana.com/tx/${txid}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Solana Explorer <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ));
      },
    });
  }, [provider]);

  const createVault = useCallback(
    async (tokenMint: PublicKey) => {
      if (!vaultClient) throw new Error('Vault client not found');

      const result = await vaultClient.createVault(tokenMint);

      return result;
    },
    [vaultClient]
  );

  const depositTokenToVault = useCallback(
    async ({ amount, vault, user }: { amount: number | BN; vault: PublicKey; user: PublicKey }) => {
      if (!vaultClient) throw new Error('Vault client not found');

      return await vaultClient.deposit(vault, new BN(amount), user);
    },
    [vaultClient]
  );

  const withdrawTokenFromVault = useCallback(
    async ({
      amount,
      vault,
      recipientPublicKey,
      user,
    }: {
      amount: number | BN;
      vault: PublicKey;
      recipientPublicKey: PublicKey;
      user: PublicKey;
    }) => {
      if (!vaultClient) throw new Error('Vault client not found');
      return await vaultClient.withdraw(vault, new BN(amount), recipientPublicKey, user);
    },
    [vaultClient]
  );

  return { vaultClient, createVault, depositTokenToVault, withdrawTokenFromVault };
}
