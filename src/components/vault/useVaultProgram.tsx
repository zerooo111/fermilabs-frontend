import { config } from '@/solana/constants';
import { LiquidityVaultClient } from '@/solana/vault_client';
import { AnchorProvider } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

export function useVaultClient() {
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
    
    console.log('Creating vault client');
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

  return vaultClient;
}
