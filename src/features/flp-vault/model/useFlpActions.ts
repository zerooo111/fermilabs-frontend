/**
 * FLP user transactions. Each one refetches the vault first (the program
 * rejects instructions built for a phase that has since changed), builds with
 * the SDK builder for the action (frontend-guide.md B.3), has the wallet sign,
 * then sends and confirms on the FLP cluster, whatever cluster the rest of the
 * app uses. Direct deposits and instant withdrawals are simulated first to set
 * their slippage bound; a failed simulation stops before the wallet prompt.
 */
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { toast } from 'sonner';

import { signTransactionOn } from '@/entities/wallet';

import { fitsLegacyPacket, type FlpClient, type VaultAccount } from '../sdk';
import { confirmSignature, FlpTxFailed, getFlp, withSendLogs } from './chain';
import { FLP_CHAIN, flpExplorerTxUrl } from './config';
import { describeFlpError, isWalletRejection } from './format';
import { API_CACHE_MS, flpKeys } from './keys';
import { pricingAccounts } from './pricing';
import { getTxState, setTxState, useTxState, type FlpPhase } from './txStore';

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
export type { FlpPhase };

export class FlpConfirmationTimeout extends Error {
  constructor(readonly signature: string) {
    super('Not confirmed yet. Check the transaction before trying again.');
  }
}

/** Slippage tolerance on simulated direct deposits and instant withdrawals. */
export const TOLERANCE_BPS = 50n;
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
  /** Success toast; `expected` is the simulated outcome, when there is one. */
  success: (expected: bigint | null) => string;
}

export interface FlpActionResult {
  signature: string;
  slot: number;
  expected: bigint | null;
}

/**
 * The vault's user transactions. Pending state, phase and toasts live outside
 * the calling component (mutation key + txStore), so closing the dialog
 * mid-send loses nothing and a second send can't start meanwhile.
 */
export function useFlpActions(vault: PublicKey) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const vaultKey = vault.toBase58();
  const tx = useTxState(vaultKey);
  const inFlight = useIsMutating({ mutationKey: flpKeys.tx(vaultKey) }) > 0;

  const mutation = useMutation({
    mutationKey: flpKeys.tx(vaultKey),
    mutationFn: async ({ kind, amount = 0n }: FlpActionInput): Promise<FlpActionResult> => {
      const owner = wallet.publicKey;
      if (!owner) throw new Error('Connect a wallet first');
      const { connection, client } = getFlp();

      setTxState(vaultKey, { phase: 'quoting', active: kind, quote: null });
      const state = await client.fetchVault(vault);
      let expected: bigint | null = null;
      const { ixs, units } = await buildFlpAction(
        kind,
        amount,
        { vault, state, owner, client },
        n => {
          expected = n;
          setTxState(vaultKey, { quote: n });
        }
      );
      const all = [ComputeBudgetProgram.setComputeUnitLimit({ units }), ...ixs];
      const size = fitsLegacyPacket(all, owner, false);
      if (!size.fits) throw new Error(`Transaction is ${size.bytes} bytes, over the 1,232 limit`);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      setTxState(vaultKey, { phase: 'signing' });
      // Signed as a devnet transaction: the wallet simulates it on that chain,
      // not on the mainnet the rest of the app trades on.
      const signedTx = await signTransactionOn(
        new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...all),
        FLP_CHAIN
      );
      const sigBytes = signedTx.signatures[0]?.signature;
      if (!sigBytes) throw new Error('Signed transaction is missing a signature');
      // Known before the send, so a time-out can still point at the transaction.
      const signature = bs58.encode(sigBytes);

      setTxState(vaultKey, { phase: 'sending' });
      try {
        // Keep preflight: it's the same RPC that served the blockhash, and its
        // simulation logs carry the program error name.
        await connection.sendRawTransaction(signedTx.serialize(), {
          preflightCommitment: 'confirmed',
          maxRetries: 10,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // A preflight rejection proves it didn't execute. A transport error
        // (HTTP 429, a dropped connection) doesn't: keep polling for it.
        if (err instanceof SendTransactionError && !msg.includes('already been processed'))
          throw await withSendLogs(err);
      }

      setTxState(vaultKey, { phase: 'confirming' });
      const confirmation = await confirmSignature(signature, lastValidBlockHeight);
      if (confirmation.status === 'expired')
        throw new Error('The transaction expired without executing. You can send it again.');
      if (confirmation.status === 'unknown') throw new FlpConfirmationTimeout(signature);
      return { signature, slot: confirmation.slot, expected };
    },
    // Options-level callbacks run even if the calling component has unmounted.
    onSuccess: (result, input) => {
      setTxState(vaultKey, {
        minSlot: Math.max(result.slot, getTxState(vaultKey).minSlot ?? 0),
        last: {
          kind: input.kind,
          amount: input.amount ?? 0n,
          expected: result.expected,
          signature: result.signature,
          slot: result.slot,
          atMs: Date.now(),
        },
      });
      toast.success(input.success(result.expected), {
        action: { label: 'View', onClick: () => window.open(flpExplorerTxUrl(result.signature)) },
      });
    },
    onError: err => {
      if (isWalletRejection(err)) {
        toast('Cancelled in wallet');
        return;
      }
      const sig =
        err instanceof FlpConfirmationTimeout || err instanceof FlpTxFailed ? err.signature : null;
      toast.error(describeFlpError(err), {
        action: sig
          ? { label: 'View', onClick: () => window.open(flpExplorerTxUrl(sig)) }
          : undefined,
      });
    },
    onSettled: () => {
      setTxState(vaultKey, { phase: 'idle', active: null });
      void queryClient.invalidateQueries({ queryKey: flpKeys.walletAll(vaultKey) });
      // The data API caches for 3 s: read once now and once past the cache.
      void queryClient.invalidateQueries({ queryKey: flpKeys.dataAll(vaultKey) });
      window.setTimeout(
        () => queryClient.invalidateQueries({ queryKey: flpKeys.dataAll(vaultKey) }),
        API_CACHE_MS
      );
    },
  });

  return {
    run: (input: FlpActionInput, onSuccess?: (r: FlpActionResult) => void) =>
      mutation.mutate(input, { onSuccess }),
    /** A transaction for this vault is in flight, from any component. */
    isPending: inFlight,
    phase: tx.phase,
    active: tx.active,
    quote: tx.quote,
  };
}
