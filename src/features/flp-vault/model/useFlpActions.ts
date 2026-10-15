/**
 * FLP deposit/withdraw. Each action refetches the vault first (the program
 * rejects instructions built for a phase that has since changed), lets the
 * SDK pick the phase's instruction, has the wallet sign, then sends and
 * confirms on the FLP cluster, whatever cluster the rest of the app uses.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction, type TransactionInstruction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import bs58 from 'bs58';

import { enrichSendError, pollForConfirmation } from '@/shared/hooks/useMangoMarginDeposit';
import { FLP_VAULT } from './config';
import { flpKeys, getFlp } from './useFlpVault';

export type FlpAction = 'deposit' | 'withdraw';
export type FlpPhase = 'idle' | 'signing' | 'sending' | 'confirming';

export class FlpConfirmationTimeout extends Error {
  constructor(readonly signature: string) {
    super('Not confirmed yet. Check the explorer before retrying.');
  }
}

export function useFlpActions() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<FlpPhase>('idle');

  const mutation = useMutation({
    mutationFn: async ({ action, amount }: { action: FlpAction; amount: bigint }) => {
      const owner = wallet.publicKey;
      if (!owner) throw new Error('Connect a wallet first');
      if (!wallet.signTransaction) throw new Error('This wallet cannot sign transactions');
      const { connection, client } = getFlp();

      const state = await client.fetchVault(FLP_VAULT);
      let ixs: TransactionInstruction[];
      if (action === 'deposit') {
        ixs = client.depositInstructions(FLP_VAULT, state, owner, amount);
      } else {
        // Immediate pre-withdrawals and terminal redemptions pay straight to
        // the quote ATA, so make sure it exists.
        const quoteAta = getAssociatedTokenAddressSync(state.quoteMint, owner);
        ixs = [
          createAssociatedTokenAccountIdempotentInstruction(
            owner,
            quoteAta,
            owner,
            state.quoteMint
          ),
          client.withdrawalInstruction(FLP_VAULT, state, owner, amount),
        ];
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...ixs);

      setPhase('signing');
      const signed = await wallet.signTransaction(tx);
      const sigBytes = signed.signatures[0]?.signature;
      if (!sigBytes) throw new Error('Signed transaction is missing a signature');
      const signature = bs58.encode(sigBytes);

      setPhase('sending');
      try {
        // Keep preflight: it's the same RPC that served the blockhash, and its
        // simulation logs carry the program error name.
        await connection.sendRawTransaction(signed.serialize(), {
          preflightCommitment: 'confirmed',
          maxRetries: 10,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already been processed')) throw await enrichSendError(err);
      }

      setPhase('confirming');
      const confirmed = await pollForConfirmation(
        connection,
        signature,
        lastValidBlockHeight,
        'confirmed'
      );
      if (!confirmed) throw new FlpConfirmationTimeout(signature);
      return { signature };
    },
    onSettled: () => {
      setPhase('idle');
      void queryClient.invalidateQueries({ queryKey: flpKeys.vault });
      if (wallet.publicKey) {
        void queryClient.invalidateQueries({ queryKey: flpKeys.user(wallet.publicKey.toBase58()) });
      }
    },
  });

  return { ...mutation, phase };
}
