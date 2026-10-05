/**
 * delegation.ts
 * On-chain side of one-click trading: the owner-signed `account_edit` that
 * sets a Fermi account's temporary delegate (with expiry), and the group gate
 * that lets delegates sign v5 intents.
 */
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import type { Group, MangoClient } from '@blockworks-foundation/mango-v4';

/** `IxGate::V5DelegateIntents` bit in the group's `ix_gate` (a set bit disables it). */
const V5_DELEGATE_INTENTS_GATE_BIT = 78;

export function delegateIntentsEnabled(group: Group): boolean {
  return !group.ixGate.testn(V5_DELEGATE_INTENTS_GATE_BIT);
}

/** How long a one-click session key stays the account's temporary delegate. */
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

/**
 * `account_edit(name: None, delegate, temporary_delegate: Some(..), expiry: Some(..))`.
 * Only the account owner may sign it. The temporary delegate stops being
 * honoured on-chain once `expiry` (unix seconds) passes; `PublicKey.default`
 * with expiry 0 revokes it. `delegate` is only touched when given, to clear a
 * permanent delegate left over from before sessions expired.
 */
export async function buildSetTemporaryDelegateInstruction(input: {
  connection: Connection;
  client: MangoClient;
  group: Group;
  mangoAccount: PublicKey;
  owner: PublicKey;
  temporaryDelegate: PublicKey;
  expiry: number;
  delegate?: PublicKey;
}): Promise<TransactionInstruction> {
  const { connection, client, group, mangoAccount, owner, temporaryDelegate, expiry, delegate } =
    input;
  const [{ AnchorProvider, BN, Program }, { IDL: MANGO_V4_IDL }] = await Promise.all([
    import('@coral-xyz/anchor'),
    import('@/shared/lib/mango-v4-idl'),
  ]);
  // Building an instruction never signs, so a read-only provider is enough.
  const readOnlyWallet = {
    publicKey: owner,
    signTransaction: () => Promise.reject(new Error('read-only provider')),
    signAllTransactions: () => Promise.reject(new Error('read-only provider')),
  };
  const provider = new AnchorProvider(connection, readOnlyWallet as any, {});
  const program = new Program(MANGO_V4_IDL as any, client.programId, provider);
  return program.methods
    .accountEdit(null, delegate ?? null, temporaryDelegate, new BN(expiry))
    .accounts({ group: group.publicKey, account: mangoAccount, owner })
    .instruction();
}
