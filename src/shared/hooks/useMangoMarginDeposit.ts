import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useCallback } from 'react';
import { API_ROUTES, config } from '@/shared/config/constants';
import {
  fetchTokenBalance,
  getAssociatedTokenAddress,
  toNative,
} from '@/shared/lib/solana/helpers';

const DEFAULT_ACCOUNT_NAME = 'frontend';
const DEFAULT_TOKEN_COUNT = 8;
const DEFAULT_SERUM3_COUNT = 4;
const DEFAULT_PERP_COUNT = 4;
const DEFAULT_PERP_OO_COUNT = 32;

interface DepositContextResponse {
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
      const contextUrl = `${config.devnet.apiBaseUrl}${API_ROUTES.deposit_context.replace('{pubkey}', owner.toBase58())}`;
      const { data: depositContext } = await axios.get<DepositContextResponse>(contextUrl);

      const [{ AnchorProvider, BN, Program }, { IDL: MANGO_V4_IDL }] = await Promise.all([
        import('@coral-xyz/anchor'),
        import('@mango-v4-client/mango_v4'),
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
      const walletBalanceRaw = await fetchTokenBalance(owner, quoteMintPk, connection);
      const walletBalanceNative = new BN(walletBalanceRaw);
      if (walletBalanceNative.lte(new BN(0))) {
        throw new Error(`no ${config.devnet.quoteTokenName} balance available in wallet`);
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

      let autoCreatedMangoAccount = false;
      let createMangoAccountTxSignature: string | null = null;
      const groupPk = new PublicKey(depositContext.group);
      const mangoAccountPk = new PublicKey(depositContext.mango_account);

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
        const createTx = new Transaction().add(createIx);
        createMangoAccountTxSignature = await provider.sendAndConfirm(createTx, []);
        autoCreatedMangoAccount = true;
      }

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

      const depositTx = new Transaction().add(depositIx);
      const txSignature = await provider.sendAndConfirm(depositTx, []);
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

  return { depositMargin };
}
