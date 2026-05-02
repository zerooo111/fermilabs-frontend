import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useCallback } from 'react';
import { API_ROUTES, config } from '@/shared/config/constants';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  fetchTokenBalance,
  getAssociatedTokenAddress,
  toNative,
} from '@/shared/lib/solana/helpers';

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

function toAccountNumLeBytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

export function useMangoMarginDeposit() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const queryClient = useQueryClient();

  const depositMargin = useCallback(
    async (requestedUiAmount?: number): Promise<MarginDepositResult> => {
      if (!wallet?.publicKey) {
        throw new Error('wallet not connected');
      }

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
      let txSignature: string;

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
        const combinedTx = new Transaction().add(createIx, depositIx);
        try {
          txSignature = await provider.sendAndConfirm(combinedTx, []);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('already been processed')) throw err;
          txSignature = 'already-processed';
        }
        autoCreatedMangoAccount = true;
        createMangoAccountTxSignature = txSignature;
      } else {
        const depositTx = new Transaction().add(depositIx);
        try {
          txSignature = await provider.sendAndConfirm(depositTx, []);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('already been processed')) throw err;
          txSignature = 'already-processed';
        }
      }

      const uiAmount =
        Number(nativeAmount.toString()) / Math.pow(10, depositContext.quote_decimals);

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
