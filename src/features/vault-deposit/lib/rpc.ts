/**
 * RPC utilities for Solana transactions
 */
import {
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  MessageV0,
  Transaction,
  type TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { type AnchorProvider } from '@coral-xyz/anchor';

export async function sendTransaction(
  provider: AnchorProvider,
  ixs: TransactionInstruction[],
  alts: AddressLookupTableAccount[],
  opts: any = {}
): Promise<string> {
  const connection = provider.connection;
  if ((connection as any).banksClient !== undefined) {
    const tx = new Transaction();
    for (const ix of ixs) {
      tx.add(ix);
    }
    tx.feePayer = provider.wallet.publicKey;
    [tx.recentBlockhash] = await (connection as any).banksClient.getLatestBlockhash();

    for (const signer of opts?.additionalSigners ?? []) {
      tx.partialSign(signer);
    }

    await (connection as any).banksClient.processTransaction(tx);
    return '';
  }
  const latestBlockhash =
    opts?.latestBlockhash ??
    (await connection.getLatestBlockhash(
      opts?.preflightCommitment ?? provider.opts.preflightCommitment ?? 'finalized'
    ));

  const payer = provider.wallet;

  if (opts?.prioritizationFee && opts.prioritizationFee !== 0) {
    ixs = [createComputeBudgetIx(opts.prioritizationFee), ...ixs];
  }

  const message = MessageV0.compile({
    payerKey: provider.wallet.publicKey,
    instructions: ixs,
    recentBlockhash: latestBlockhash.blockhash,
    addressLookupTableAccounts: alts,
  });
  let vtx = new VersionedTransaction(message);

  if (opts?.additionalSigners !== undefined && opts?.additionalSigners.length !== 0) {
    vtx.sign([...(opts?.additionalSigners ?? [])]);
  }

  vtx = (await payer.signTransaction(vtx as any)) as unknown as VersionedTransaction;

  // Derive signature before sending — Solana tx signature is deterministic
  // (first Ed25519 sig). maxRetries:0 prevents auto-retries that cause
  // "already been processed" errors when the tx confirms on the first send.
  const txSigBytes = vtx.signatures[0];
  const derivedSignature = txSigBytes ? bs58.encode(txSigBytes) : null;

  let signature: string;
  try {
    signature = await connection.sendRawTransaction(vtx.serialize(), {
      skipPreflight: true,
      maxRetries: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already been processed') && derivedSignature) {
      signature = derivedSignature;
    } else {
      throw err;
    }
  }

  if (opts?.postSendTxCallback !== undefined && opts?.postSendTxCallback !== null) {
    try {
      opts.postSendTxCallback({ txid: signature });
    } catch {
      // Silent error handling
    }
  }

  const txConfirmationCommitment = opts?.txConfirmationCommitment ?? 'confirmed';
  let status: any;
  if (latestBlockhash.blockhash != null && latestBlockhash.lastValidBlockHeight != null) {
    status = (
      await connection.confirmTransaction(
        {
          signature: signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        txConfirmationCommitment
      )
    ).value;
  } else {
    status = (await connection.confirmTransaction(signature, txConfirmationCommitment)).value;
  }
  if (status.err !== '' && status.err !== null) {
    // Silent error handling
    throw new OpenBookError({
      txid: signature,
      message: `${JSON.stringify(status)}`,
    });
  }

  return signature;
}

export const createComputeBudgetIx = (microLamports: number): TransactionInstruction => {
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports,
  });
  return computeBudgetIx;
};

class OpenBookError extends Error {
  message: string;
  txid: string;

  constructor({ txid, message }: any) {
    super();
    this.message = message;
    this.txid = txid;
  }
}
