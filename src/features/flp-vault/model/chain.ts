/**
 * FLP cluster access: one shared Connection and SDK client, and the wallet
 * balances the forms need exact (SOL for fees, test USDC, FLP shares), read
 * in one getMultipleAccounts call.
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';

import { FlpClient, TOKEN_2022_PROGRAM_ID } from '../sdk';
import { FLP_PROGRAM_ID, FLP_RPC_URL } from './config';

export const COMMITMENT = 'confirmed' as const;

let shared: { connection: Connection; client: FlpClient } | null = null;
export function getFlp() {
  if (!shared) {
    const connection = new Connection(FLP_RPC_URL, COMMITMENT);
    shared = { connection, client: new FlpClient(connection, FLP_PROGRAM_ID) };
  }
  return shared;
}

export interface FlpWallet {
  lamports: bigint;
  quoteAta: PublicKey;
  quoteBalance: bigint;
  shareAta: PublicKey;
  shareBalance: bigint;
}

export async function readWallet(
  owner: PublicKey,
  quoteMint: PublicKey,
  shareMint: PublicKey
): Promise<FlpWallet> {
  const { connection } = getFlp();
  const quoteAta = getAssociatedTokenAddressSync(quoteMint, owner, true);
  const shareAta = getAssociatedTokenAddressSync(shareMint, owner, true, TOKEN_2022_PROGRAM_ID);
  const [ownerInfo, quoteInfo, shareInfo] = await connection.getMultipleAccountsInfo(
    [owner, quoteAta, shareAta],
    COMMITMENT
  );
  return {
    lamports: BigInt(ownerInfo?.lamports ?? 0),
    quoteAta,
    quoteBalance: quoteInfo ? unpackAccount(quoteAta, quoteInfo).amount : 0n,
    shareAta,
    shareBalance: shareInfo ? unpackAccount(shareAta, shareInfo, TOKEN_2022_PROGRAM_ID).amount : 0n,
  };
}
