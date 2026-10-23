/**
 * FLP user transactions. Each one refetches the vault first (the program
 * rejects instructions built for a phase that has since changed), builds with
 * the SDK builder for the action (frontend-guide.md B.3), has the wallet sign,
 * then sends and confirms on the FLP cluster, whatever cluster the rest of the
 * app uses. Direct deposits and instant withdrawals are simulated first to set
 * their slippage bound; a failed simulation stops before the wallet prompt.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ComputeBudgetProgram,
  PublicKey,
  SendTransactionError,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import bs58 from 'bs58';

import { enrichSendError, pollForConfirmation } from '@/shared/hooks/useMangoMarginDeposit';
import { fitsLegacyPacket, type FlpClient, type VaultAccount } from '../sdk';
import { getFlp } from './chain';
import { pricingAccounts } from './pricing';

export type FlpActionKind =
  | 'deposit'
  | 'direct-deposit'
  | 'refund'
  | 'withdraw'
  | 'instant-withdraw'
  | 'cancel-deposit'
  | 'cancel-withdraw'
  | 'claim-deposit'
  | 'refund-pending-deposit'
  | 'claim-withdrawal'
  | 'claim-graduated';
export type FlpPhase = 'idle' | 'quoting' | 'signing' | 'sending' | 'confirming';

export class FlpConfirmationTimeout extends Error {
  constructor(readonly signature: string) {
    super('Not confirmed yet. Check the explorer before retrying.');
  }
}

// Slippage tolerance on simulated direct deposits and instant withdrawals.
const TOLERANCE_BPS = 50n;
const CU_PRICED = 300_000;
const CU_DEFAULT = 100_000;

export interface FlpActionCtx {
  vault: PublicKey;
  state: VaultAccount;
  owner: PublicKey;
  client: FlpClient;
}

const quoteAtaIx = ({ state, owner }: FlpActionCtx) =>
  createAssociatedTokenAccountIdempotentInstruction(
    owner,
    getAssociatedTokenAddressSync(state.quoteMint, owner, true),
    owner,
    state.quoteMint
  );
const shareAtaIx = ({ state, owner, client }: FlpActionCtx) =>
  client.shareAtaInstructions(state, owner).instruction;

async function simulate(ixs: TransactionInstruction[], owner: PublicKey, units: number) {
  const { connection, client } = getFlp();
  const message = new TransactionMessage({
    payerKey: owner,
    recentBlockhash: PublicKey.default.toBase58(),
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units }), ...ixs],
  }).compileToLegacyMessage();
  const sim = await connection.simulateTransaction(new VersionedTransaction(message), {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: 'confirmed',
  });
  const logs = sim.value.logs ?? [];
  if (sim.value.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}\n${logs.join('\n')}`);
  }
  return client.parseEvents(logs);
}

const lessTolerance = (n: bigint) => (n * (10_000n - TOLERANCE_BPS)) / 10_000n;

/** Instructions and compute limit for one user action, built on a fresh vault read. */
export async function buildFlpAction(
  kind: FlpActionKind,
  amount: bigint,
  ctx: FlpActionCtx,
  quoted: (expected: bigint) => void
): Promise<{ ixs: TransactionInstruction[]; units: number }> {
  const { vault, state, owner, client } = ctx;
  switch (kind) {
    case 'deposit':
      // Pre-deposit escrow before graduation, a queued request after it.
      return {
        ixs: [shareAtaIx(ctx), ...client.depositInstructions(vault, state, owner, amount)],
        units: CU_DEFAULT,
      };
    case 'direct-deposit': {
      const { accounts, health } = await pricingAccounts(vault, state);
      const draft = (min: bigint) =>
        client.permissionedDepositInstructions(vault, state, owner, amount, min, accounts, health);
      const events = await simulate(draft(1n), owner, CU_PRICED);
      const event = events.find(e => e.name === 'FlpPermissionedDeposit');
      if (!event) throw new Error('The deposit simulation returned no shares');
      const shares = BigInt(String((event.data as { shares: unknown }).shares));
      quoted(shares);
      return { ixs: draft(lessTolerance(shares)), units: CU_PRICED };
    }
    case 'refund':
      return {
        ixs: [quoteAtaIx(ctx), client.publicRefundInstruction(vault, state, owner, amount)],
        units: CU_DEFAULT,
      };
    case 'withdraw':
      // Trading shares: a queued request, or a terminal redemption once closed.
      // Never `withdrawalInstruction`: before graduation it's the escrow refund.
      return {
        ixs: [quoteAtaIx(ctx), client.tradingWithdrawalInstruction(vault, state, owner, amount)],
        units: CU_DEFAULT,
      };
    case 'instant-withdraw': {
      const { accounts, health } = await pricingAccounts(vault, state);
      const draft = (min: bigint) => [
        quoteAtaIx(ctx),
        client.permissionedWithdraw(vault, state, owner, amount, min, accounts, health),
      ];
      const events = await simulate(draft(0n), owner, CU_PRICED);
      const event = events.find(e => e.name === 'FlpPermissionedWithdrawal');
      if (!event) throw new Error('The withdrawal simulation returned no payout');
      const net = BigInt(String((event.data as { net: unknown }).net));
      quoted(net);
      return { ixs: draft(lessTolerance(net)), units: CU_PRICED };
    }
    case 'cancel-deposit':
      return {
        ixs: [quoteAtaIx(ctx), client.cancelDeposit(vault, state, owner)],
        units: CU_DEFAULT,
      };
    case 'cancel-withdraw':
      return {
        ixs: [shareAtaIx(ctx), client.cancelWithdraw(vault, state, owner)],
        units: CU_DEFAULT,
      };
    case 'claim-deposit': {
      const depositor = await client.fetchDepositor(vault, owner);
      const record = await client.fetchEpoch(vault, depositor.dep.epoch);
      return {
        ixs: [
          shareAtaIx(ctx),
          quoteAtaIx(ctx),
          client.settleDepositInstruction(vault, state, owner, record),
        ],
        units: CU_DEFAULT,
      };
    }
    case 'refund-pending-deposit':
      return {
        ixs: [quoteAtaIx(ctx), client.refundPendingDeposit(vault, state, owner)],
        units: CU_DEFAULT,
      };
    case 'claim-withdrawal': {
      const depositor = await client.fetchDepositor(vault, owner);
      return {
        ixs: [quoteAtaIx(ctx), client.claimWithdrawal(vault, state, owner, depositor.wd.epoch)],
        units: CU_DEFAULT,
      };
    }
    case 'claim-graduated':
      return {
        ixs: [shareAtaIx(ctx), client.claimPreDeposit(vault, state, owner)],
        units: CU_DEFAULT,
      };
  }
}

export interface FlpActionInput {
  kind: FlpActionKind;
  /** Native USDC or shares, by action; ignored by claims and cancels. */
  amount?: bigint;
}

export function useFlpActions(vault: PublicKey) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<FlpPhase>('idle');
  const [quote, setQuote] = useState<bigint | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ kind, amount = 0n }: FlpActionInput) => {
      const owner = wallet.publicKey;
      if (!owner) throw new Error('Connect a wallet first');
      if (!wallet.signTransaction) throw new Error('This wallet cannot sign transactions');
      const { connection, client } = getFlp();
      setQuote(null);

      setPhase('quoting');
      const state = await client.fetchVault(vault);
      let expected: bigint | null = null;
      const { ixs, units } = await buildFlpAction(
        kind,
        amount,
        { vault, state, owner, client },
        n => {
          expected = n;
          setQuote(n);
        }
      );
      const all = [ComputeBudgetProgram.setComputeUnitLimit({ units }), ...ixs];
      const size = fitsLegacyPacket(all, owner, false);
      if (!size.fits) throw new Error(`Transaction is ${size.bytes} bytes, over the 1,232 limit`);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...all);

      setPhase('signing');
      const signed = await wallet.signTransaction(tx);
      const sigBytes = signed.signatures[0]?.signature;
      if (!sigBytes) throw new Error('Signed transaction is missing a signature');
      // Known before the send, so a time-out can still point at the transaction.
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
        // A preflight rejection proves it didn't execute. A transport error
        // (HTTP 429, a dropped connection) doesn't: keep polling for it.
        if (err instanceof SendTransactionError && !msg.includes('already been processed'))
          throw await enrichSendError(err);
      }

      setPhase('confirming');
      const confirmed = await pollForConfirmation(
        connection,
        signature,
        lastValidBlockHeight,
        'confirmed'
      );
      if (!confirmed) throw new FlpConfirmationTimeout(signature);
      return { signature, expected: expected as bigint | null };
    },
    onSettled: () => {
      setPhase('idle');
      void queryClient.invalidateQueries({ queryKey: ['flp', 'wallet', vault.toBase58()] });
      // The data API caches for 3 s: read once now and once past the cache.
      void queryClient.invalidateQueries({ queryKey: ['flp', 'data', vault.toBase58()] });
      window.setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ['flp', 'data', vault.toBase58()] }),
        3_500
      );
    },
  });

  return { ...mutation, phase, quote };
}
