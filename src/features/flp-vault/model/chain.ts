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

const POLL_MS = 2_000;
const CONFIRM_TIMEOUT_MS = 90_000;

export type Confirmation =
  | { status: 'confirmed'; slot: number }
  /** The blockhash expired and the network never saw it: safe to send again. */
  | { status: 'expired' }
  /** Still unknown: look the signature up before sending again. */
  | { status: 'unknown' };

/**
 * Wait for `signature` (sdk-guide.md 5). A read error, such as HTTP 429 from
 * the public RPC, never proves a failure: it's retried at a slower pace.
 * Throws only when the transaction executed with an error.
 */
export async function confirmSignature(
  signature: string,
  lastValidBlockHeight: number
): Promise<Confirmation> {
  const { connection } = getFlp();
  const start = Date.now();
  let readErrors = 0;
  for (let i = 1; Date.now() - start < CONFIRM_TIMEOUT_MS; i++) {
    await new Promise(r => setTimeout(r, readErrors ? POLL_MS * 2 : POLL_MS));
    try {
      const status = (await connection.getSignatureStatuses([signature])).value[0];
      readErrors = 0;
      if (status?.err) throw new FlpTxFailed(signature, status.err);
      if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized')
        return { status: 'confirmed', slot: status.slot };
      // Check expiry every fifth poll only, to spare the RPC.
      if (!status && i % 5 === 0) {
        const height = await connection.getBlockHeight(COMMITMENT);
        if (height > lastValidBlockHeight) {
          const last = (
            await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })
          ).value[0];
          if (last?.err) throw new FlpTxFailed(signature, last.err);
          return last ? { status: 'confirmed', slot: last.slot } : { status: 'expired' };
        }
      }
    } catch (err) {
      if (err instanceof FlpTxFailed) throw err;
      readErrors++;
    }
  }
  return { status: 'unknown' };
}

/** The transaction executed and failed; nothing changed on chain. */
export class FlpTxFailed extends Error {
  constructor(
    readonly signature: string,
    err: unknown
  ) {
    super(`Transaction failed: ${typeof err === 'string' ? err : JSON.stringify(err)}`);
  }
}

export interface FlpWallet {
  lamports: bigint;
  quoteAta: PublicKey;
  quoteBalance: bigint;
  shareAta: PublicKey;
  shareBalance: bigint;
}

/** The wallet's test-USDC and (Token-2022) FLP share accounts. */
export function walletAtas(owner: PublicKey, quoteMint: PublicKey, shareMint: PublicKey) {
  return {
    quoteAta: getAssociatedTokenAddressSync(quoteMint, owner, true),
    shareAta: getAssociatedTokenAddressSync(shareMint, owner, true, TOKEN_2022_PROGRAM_ID),
  };
}

export async function readWallet(
  owner: PublicKey,
  quoteMint: PublicKey,
  shareMint: PublicKey
): Promise<FlpWallet> {
  const { connection } = getFlp();
  const { quoteAta, shareAta } = walletAtas(owner, quoteMint, shareMint);
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
