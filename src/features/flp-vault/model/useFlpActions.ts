/**
 * FLP user transactions. Each one refetches the vault first (the program
 * rejects instructions built for a phase that has since changed), builds with
 * the RC6 version-4 builder for the action (INTEGRATION_GUIDE.md "Public and
 * permissioned users"), has the wallet sign, then sends and confirms on the
 * FLP cluster, whatever cluster the rest of the app uses. Direct deposits and
 * instant withdrawals are simulated first to set their slippage bound; a
 * failed simulation, or a wallet with too little SOL for the fee, stops before
 * the wallet prompt.
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
import bs58 from 'bs58';
import { toast } from 'sonner';

import { assertEnoughSol } from '@/shared/lib/solana/gas';

import {
  fitsLegacyPacket,
  NONE_EPOCH,
  STATUS,
  vaultMode,
  type FlpV4Client,
  type VaultAccount,
} from '../sdk';
import { COMMITMENT, confirmSignature, FlpTxFailed, getFlp, withSendLogs } from './chain';
import { flpExplorerTxUrl } from './config';
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
  client: FlpV4Client;
}

// The version-4 builders leave phase checks to the program. These repeat the
// ones the earlier SDK made, so a stale page fails before the wallet prompt.
function requireDeposits(state: VaultAccount, publicRoute: boolean) {
  const blocked =
    STATUS.depositsPaused |
    STATUS.breaker |
    STATUS.unwind |
    STATUS.closed |
    (publicRoute ? STATUS.publicDepositsPaused : 0);
  if (state.status & blocked) throw new Error('Deposits are unavailable');
}
function requireWithdrawals(state: VaultAccount) {
  if (state.status & STATUS.withdrawalsPaused) throw new Error('Withdrawals are paused');
}

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
  const mode = vaultMode(state.status);
  // Each builder returns its whole array, starting with the idempotent
  // initDepositor and the destination token accounts it needs: one transaction.
  const plain = (ixs: TransactionInstruction[]) => ({ ixs, units: CU_DEFAULT });
  switch (kind) {
    case 'deposit':
      // Public principal before graduation, a queued request after it.
      requireDeposits(state, true);
      if (mode === 'pre-deposit')
        return plain(client.preDepositInstructions(vault, state, owner, amount));
      if (mode === 'live')
        return plain(client.requestDepositInstructions(vault, state, owner, amount));
      throw new Error('Deposits are unavailable');
    case 'direct-deposit': {
      requireDeposits(state, false);
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
      // Public principal only (never trading shares, guide B.2 rule 11).
      if (!(state.status & STATUS.preDeposit))
        throw new Error('Public principal already graduated; claim shares and use the queue');
      return plain(client.preWithdrawInstructions(vault, state, owner, amount));
    case 'withdraw':
      // Trading shares: a queued request, or a terminal redemption once closed.
      if (state.status & STATUS.closed)
        return plain(client.terminalRedeemInstructions(vault, state, owner, amount));
      requireWithdrawals(state);
      return plain(client.requestWithdrawInstructions(vault, state, owner, amount));
    case 'instant-withdraw': {
      if (mode !== 'pre-deposit' || state.status & (STATUS.breaker | STATUS.unwind))
        throw new Error('Instant withdrawals are available only before graduation');
      requireWithdrawals(state);
      if (!state.deferredHead.eq(NONE_EPOCH))
        throw new Error('An older withdrawal batch is funded first');
      const { accounts, health } = await pricingAccounts(vault, state);
      const draft = (min: bigint) =>
        client.permissionedWithdrawInstructions(vault, state, owner, amount, min, accounts, health);
      const events = await simulate(draft(0n), owner, CU_PRICED);
      const event = events.find(e => e.name === 'FlpPermissionedWithdrawal');
      if (!event) throw new Error('The withdrawal simulation returned no payout');
      const net = BigInt(String((event.data as { net: unknown }).net));
      quoted(net);
      return { ixs: draft(lessTolerance(net)), units: CU_PRICED };
    }
    case 'cancel-deposit':
      return plain(client.cancelDepositInstructions(vault, state, owner));
    case 'cancel-withdraw':
      return plain(client.cancelWithdrawInstructions(vault, state, owner));
    case 'claim-deposit': {
      // The actual epoch record decides: shares, or a refund if it held deposits.
      const depositor = await client.fetchDepositor(vault, owner);
      const record = await client.fetchEpoch(vault, depositor.dep.epoch);
      return plain(client.settleDepositInstructions(vault, state, owner, record));
    }
    case 'refund-pending-deposit':
      return plain(client.refundPendingDepositInstructions(vault, state, owner));
    case 'claim-withdrawal': {
      const depositor = await client.fetchDepositor(vault, owner);
      return plain(client.claimWithdrawalInstructions(vault, state, owner, depositor.wd.epoch));
    }
    case 'claim-graduated':
      return plain(client.claimPreDepositInstructions(vault, state, owner));
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
      if (!wallet.signTransaction) throw new Error('This wallet cannot sign transactions');
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

      // A wallet that can't pay the fee fails simulation inside the wallet, and
      // Phantom shows that as an "this dApp may be unsafe" warning: never let
      // the prompt open in that state.
      assertEnoughSol(await connection.getBalance(owner, COMMITMENT), {
        needsAccountCreation: false,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      setTxState(vaultKey, { phase: 'signing' });
      // The app's Privy wallet, on the app's (mainnet) chain.
      const signedTx = await wallet.signTransaction(
        new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(...all)
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
