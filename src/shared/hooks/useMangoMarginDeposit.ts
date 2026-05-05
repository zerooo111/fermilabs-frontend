import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import bs58 from 'bs58';
import { ComputeBudgetProgram, PublicKey, Transaction } from '@solana/web3.js';
import { useCallback } from 'react';
import { API_ROUTES, config } from '@/shared/config/constants';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  fetchTokenBalance,
  getAssociatedTokenAddress,
  toNative,
} from '@/shared/lib/solana/helpers';

// Mango v4 token deposit + account create together comfortably fit under
// 300k CU; bump to 400k as a safety margin on a hot lane. Priority fee is
// modest (50k microLamports/CU ~= 0.00002 SOL) — enough to keep the tx out
// of starvation without burning fees on devnet.
const COMPUTE_UNIT_LIMIT = 400_000;
const COMPUTE_UNIT_PRICE_MICROLAMPORTS = 50_000;
// How long we'll actively poll for confirmation before surfacing a
// "still pending" state to the UI. The signed tx remains valid until the
// blockhash expires (~60-90s) so polling longer than that is wasted.
const CONFIRM_TIMEOUT_MS = 60_000;
const CONFIRM_POLL_INTERVAL_MS = 1_500;

// Thrown when the tx was sent successfully but didn't reach the requested
// commitment within the timeout. The modal uses this to render a
// "still pending" UI with an explorer link instead of treating it as a
// hard failure (the deposit may still confirm on-chain shortly).
export class DepositConfirmationTimeoutError extends Error {
  readonly txSignature: string;
  constructor(txSignature: string) {
    super('deposit transaction is still pending confirmation');
    this.name = 'DepositConfirmationTimeoutError';
    this.txSignature = txSignature;
  }
}

const DEFAULT_ACCOUNT_NAME = 'frontend';
const DEFAULT_TOKEN_COUNT = 8;
const DEFAULT_SERUM3_COUNT = 0;
const DEFAULT_PERP_COUNT = 4;
const DEFAULT_PERP_OO_COUNT = 32;

export interface DepositContextResponse {
  owner: string;
  group: string;
  program_id: string;
  quote_mint: string;
  quote_decimals: number;
  quote_bank: string;
  quote_vault: string;
  quote_oracle: string;
  mango_account: string;
  mango_account_exists: boolean;
  account_num: number;
  health_remaining_accounts: string[];
  default_ui_amount: number;
}

export interface MarginWithdrawResult {
  ok: boolean;
  uiAmount: number;
  txSignature: string;
}

export interface MarginDepositResult {
  ok: boolean;
  mangoAccount: string;
  uiAmount: number;
  rawAmount: string;
  txSignature: string;
  autoCreatedMangoAccount: boolean;
  createMangoAccountTxSignature: string | null;
}

export type DepositPhase =
  | 'preparing'
  | 'awaiting-signature'
  | 'sending'
  | 'confirming'
  | 'finalizing';

export interface DepositOptions {
  onPhase?: (phase: DepositPhase) => void;
  // Fired as soon as the wallet returns a signed tx and we have a signature
  // we can show to the user (even before send/confirm completes). The modal
  // uses this to render an explorer link immediately so the user can verify
  // the deposit even if the confirmation step stalls.
  onSubmitted?: (txSignature: string) => void;
}

function toAccountNumLeBytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

// Polling-based confirmation. Returns true on confirm/finalize, false on
// timeout. Throws if the tx itself errored on-chain. We deliberately avoid
// `connection.confirmTransaction` because its websocket subscription path
// hangs silently on lossy RPCs (api.devnet.solana.com drops notifications
// under load), which is the root cause of the "deposit gets stuck, comes
// later" reports.
async function pollForConfirmation(
  connection: import('@solana/web3.js').Connection,
  signature: string,
  lastValidBlockHeight: number,
  commitment: import('@solana/web3.js').Commitment
): Promise<boolean> {
  const start = Date.now();
  const target =
    commitment === 'finalized' ? new Set(['finalized']) : new Set(['confirmed', 'finalized']);

  while (Date.now() - start < CONFIRM_TIMEOUT_MS) {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: false,
    });
    const status = value?.[0];
    if (status) {
      if (status.err) {
        throw new Error(
          `transaction failed on-chain: ${typeof status.err === 'string' ? status.err : JSON.stringify(status.err)}`
        );
      }
      if (status.confirmationStatus && target.has(status.confirmationStatus)) {
        return true;
      }
    }
    // Stop early if the blockhash window has closed; the tx is dead and
    // won't land anymore. Treat this as a hard timeout.
    try {
      const currentHeight = await connection.getBlockHeight(commitment);
      if (currentHeight > lastValidBlockHeight) return false;
    } catch {
      // ignore — height check is best-effort
    }
    await new Promise(resolve => setTimeout(resolve, CONFIRM_POLL_INTERVAL_MS));
  }
  return false;
}

export function useMangoMarginDeposit() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();

  const depositMargin = useCallback(
    async (requestedUiAmount?: number, options?: DepositOptions): Promise<MarginDepositResult> => {
      if (!wallet?.publicKey) {
        throw new Error('wallet not connected');
      }

      const reportPhase = (phase: DepositPhase) => options?.onPhase?.(phase);

      reportPhase('preparing');

      const owner = wallet.publicKey;
      const contextUrl = `${config.devnet.gatewayUrl}${API_ROUTES.deposit_context.replace('{pubkey}', owner.toBase58())}`;
      const { data: depositContext } = await axios.get<DepositContextResponse>(contextUrl);

      const [{ AnchorProvider, BN, Program }, { IDL: MANGO_V4_IDL }] = await Promise.all([
        import('@coral-xyz/anchor'),
        import('@/shared/lib/mango-v4-idl'),
      ]);
      const provider = new AnchorProvider(connection, wallet, {
        commitment: config.devnet.commitment,
      });
      const program = new Program(
        MANGO_V4_IDL as any,
        new PublicKey(depositContext.program_id),
        provider
      );

      const quoteMintPk = new PublicKey(depositContext.quote_mint);
      let walletBalanceRaw: string;
      try {
        walletBalanceRaw = await fetchTokenBalance(owner, quoteMintPk, connection);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `failed to fetch ${config.devnet.quoteTokenName} token account (mint: ${depositContext.quote_mint}): ${msg}`
        );
      }
      const walletBalanceNative = new BN(walletBalanceRaw);
      if (walletBalanceNative.lte(new BN(0))) {
        throw new Error(
          `no ${config.devnet.quoteTokenName} balance available in wallet (mint: ${depositContext.quote_mint})`
        );
      }

      const targetUiAmount =
        requestedUiAmount ?? depositContext.default_ui_amount ?? config.devnet.mangoDepositUiAmount;
      const requestedNativeAmount = toNative(targetUiAmount, depositContext.quote_decimals);
      const nativeAmount = walletBalanceNative.lt(requestedNativeAmount)
        ? walletBalanceNative
        : requestedNativeAmount;

      if (nativeAmount.lte(new BN(0))) {
        throw new Error('deposit amount must be positive');
      }

      const groupPk = new PublicKey(depositContext.group);
      const mangoAccountPk = new PublicKey(depositContext.mango_account);

      const depositIx = await program.methods
        .tokenDeposit(nativeAmount, false)
        .accounts({
          group: groupPk,
          account: mangoAccountPk,
          owner,
          bank: new PublicKey(depositContext.quote_bank),
          vault: new PublicKey(depositContext.quote_vault),
          oracle: new PublicKey(depositContext.quote_oracle),
          tokenAccount: await getAssociatedTokenAddress(quoteMintPk, owner),
          tokenAuthority: owner,
        })
        .remainingAccounts(
          depositContext.health_remaining_accounts.map(pubkey => ({
            pubkey: new PublicKey(pubkey),
            isSigner: false,
            isWritable: false,
          }))
        )
        .instruction();

      let autoCreatedMangoAccount = false;
      let createMangoAccountTxSignature: string | null = null;

      const tx = new Transaction();
      // Compute budget instructions go first so they apply to all subsequent
      // ixs in this tx. Without these the deposit can fail silently under
      // network load (CU starvation) or get stuck behind higher-priority txs.
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: COMPUTE_UNIT_PRICE_MICROLAMPORTS,
        })
      );
      if (!depositContext.mango_account_exists) {
        const [expectedMangoAccountPk] = PublicKey.findProgramAddressSync(
          [
            new TextEncoder().encode('MangoAccount'),
            groupPk.toBuffer(),
            owner.toBuffer(),
            toAccountNumLeBytes(depositContext.account_num),
          ],
          new PublicKey(depositContext.program_id)
        );
        if (!expectedMangoAccountPk.equals(mangoAccountPk)) {
          throw new Error('deposit context mango account derivation mismatch');
        }

        const createIx = await program.methods
          .accountCreate(
            depositContext.account_num,
            DEFAULT_TOKEN_COUNT,
            DEFAULT_SERUM3_COUNT,
            DEFAULT_PERP_COUNT,
            DEFAULT_PERP_OO_COUNT,
            DEFAULT_ACCOUNT_NAME
          )
          .accounts({
            group: groupPk,
            owner,
            payer: owner,
          })
          .instruction();

        // Combine both in one tx — avoids simulation ordering issues where
        // MetaMask sees the deposit instruction before the account exists.
        tx.add(createIx, depositIx);
        autoCreatedMangoAccount = true;
      } else {
        tx.add(depositIx);
      }

      // Manual sign → send → confirm so the caller can hook into each phase
      // for progressive UI updates. provider.sendAndConfirm bundles all three
      // into one opaque promise and uses the websocket subscription path for
      // confirmation, which silently drops notifications on lossy public RPCs
      // and leaves the user staring at an indefinite spinner.
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
        config.devnet.commitment
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = owner;

      reportPhase('awaiting-signature');
      const signedTx = await wallet.signTransaction(tx);

      // Derive the signature locally so we can surface an explorer link to
      // the user even if sendRawTransaction fails with "already processed".
      const localSigBytes = signedTx.signatures[0]?.signature;
      if (!localSigBytes) {
        throw new Error('signed transaction is missing a signature');
      }
      const localSig = bs58.encode(localSigBytes);
      options?.onSubmitted?.(localSig);

      reportPhase('sending');
      let txSignature: string;
      try {
        txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          // The wallet's RPC may have already broadcast a copy. Allow the
          // duplicate so we don't lose track of the signature.
          maxRetries: 5,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already been processed')) throw err;
        // Still keep the signature; the tx is on the network even though
        // our send attempt was a no-op.
        txSignature = localSig;
      }

      reportPhase('confirming');
      const confirmed = await pollForConfirmation(
        connection,
        txSignature,
        lastValidBlockHeight,
        config.devnet.commitment
      );

      if (!confirmed) {
        // Fire query invalidation defensively so the UI can recover on its
        // own if the tx confirms shortly after the modal closes.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['userBalances', owner.toBase58()] }),
          queryClient.invalidateQueries({ queryKey: ['account', owner.toBase58()] }),
          queryClient.invalidateQueries({ queryKey: ['positions', owner.toBase58()] }),
        ]);
        throw new DepositConfirmationTimeoutError(txSignature);
      }

      if (autoCreatedMangoAccount) {
        createMangoAccountTxSignature = txSignature;
      }

      const uiAmount =
        Number(nativeAmount.toString()) / Math.pow(10, depositContext.quote_decimals);

      reportPhase('finalizing');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['userBalances', owner.toBase58()] }),
        queryClient.invalidateQueries({ queryKey: ['account', owner.toBase58()] }),
        queryClient.invalidateQueries({ queryKey: ['positions', owner.toBase58()] }),
      ]);

      return {
        ok: true,
        mangoAccount: mangoAccountPk.toBase58(),
        uiAmount,
        rawAmount: nativeAmount.toString(),
        txSignature,
        autoCreatedMangoAccount,
        createMangoAccountTxSignature,
      };
    },
    [connection, queryClient, wallet]
  );

  const withdrawMargin = useCallback(
    async (requestedUiAmount: number): Promise<MarginWithdrawResult> => {
      if (!wallet?.publicKey) {
        throw new Error('wallet not connected');
      }

      const owner = wallet.publicKey;
      const contextUrl = `${config.devnet.gatewayUrl}${API_ROUTES.deposit_context.replace('{pubkey}', owner.toBase58())}`;
      const { data: depositContext } = await axios.get<DepositContextResponse>(contextUrl);

      if (!depositContext.mango_account_exists) {
        throw new Error('no margin account found — deposit first to create one');
      }

      const [{ AnchorProvider, BN, Program }, { IDL: MANGO_V4_IDL }] = await Promise.all([
        import('@coral-xyz/anchor'),
        import('@/shared/lib/mango-v4-idl'),
      ]);
      const provider = new AnchorProvider(connection, wallet, {
        commitment: config.devnet.commitment,
      });
      const program = new Program(
        MANGO_V4_IDL as any,
        new PublicKey(depositContext.program_id),
        provider
      );

      const quoteMintPk = new PublicKey(depositContext.quote_mint);
      const groupPk = new PublicKey(depositContext.group);
      const mangoAccountPk = new PublicKey(depositContext.mango_account);
      const tokenAccountPk = await getAssociatedTokenAddress(quoteMintPk, owner);
      const nativeAmount = toNative(requestedUiAmount, depositContext.quote_decimals);

      const withdrawIx = await program.methods
        .tokenWithdraw(nativeAmount, false)
        .accounts({
          group: groupPk,
          account: mangoAccountPk,
          owner,
          bank: new PublicKey(depositContext.quote_bank),
          vault: new PublicKey(depositContext.quote_vault),
          oracle: new PublicKey(depositContext.quote_oracle),
          tokenAccount: tokenAccountPk,
        })
        .remainingAccounts(
          depositContext.health_remaining_accounts.map(pubkey => ({
            pubkey: new PublicKey(pubkey),
            isSigner: false,
            isWritable: false,
          }))
        )
        .instruction();

      // Idempotent ATA creation — no-op if the account already exists.
      const createAtaIx = await createAssociatedTokenAccountIdempotentInstruction(
        owner,
        owner,
        quoteMintPk
      );

      const tx = new Transaction().add(createAtaIx, withdrawIx);
      let txSignature: string;
      try {
        txSignature = await provider.sendAndConfirm(tx, []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already been processed')) throw err;
        txSignature = 'already-processed';
      }

      const uiAmount =
        Number(nativeAmount.toString()) / Math.pow(10, depositContext.quote_decimals);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['userBalances', owner.toBase58()] }),
        queryClient.invalidateQueries({ queryKey: ['account', owner.toBase58()] }),
        queryClient.invalidateQueries({ queryKey: ['positions', owner.toBase58()] }),
      ]);

      return { ok: true, uiAmount, txSignature };
    },
    [connection, queryClient, wallet]
  );

  return { depositMargin, withdrawMargin };
}
