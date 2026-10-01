/**
 * delegation.ts
 * On-chain side of one-click trading: the owner-signed `account_edit` that
 * sets a Fermi account's delegate, and the group gate that lets delegates
 * sign v5 intents.
 */
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import type { Group, MangoClient } from '@blockworks-foundation/mango-v4';

/** `IxGate::V5DelegateIntents` bit in the group's `ix_gate` (a set bit disables it). */
const V5_DELEGATE_INTENTS_GATE_BIT = 78;

export function delegateIntentsEnabled(group: Group): boolean {
  return !group.ixGate.testn(V5_DELEGATE_INTENTS_GATE_BIT);
}

/**
 * `account_edit(name: None, delegate: Some(delegate), temporary_delegate: None, expiry: None)`.
 * Only the account owner may sign it. `PublicKey.default` revokes delegation.
 */
export async function buildSetDelegateInstruction(input: {
  connection: Connection;
  client: MangoClient;
  group: Group;
  mangoAccount: PublicKey;
  owner: PublicKey;
  delegate: PublicKey;
}): Promise<TransactionInstruction> {
  const { connection, client, group, mangoAccount, owner, delegate } = input;
  const [{ AnchorProvider, Program }, { IDL: MANGO_V4_IDL }] = await Promise.all([
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
    .accountEdit(null, delegate, null, null)
    .accounts({ group: group.publicKey, account: mangoAccount, owner })
    .instruction();
}
