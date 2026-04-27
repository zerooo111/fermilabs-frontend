import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Group, MangoClient } from '@blockworks-foundation/mango-v4';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { config } from '@/shared/config/constants';

// MangoClient is initialised once per session for *read-only* group / mango-account
// fetches required to build canonical perp remaining accounts (see
// mango-canonical-accounts.ts). The throwaway `Wallet` here only satisfies the
// AnchorProvider interface for IDL loads — it is never asked to sign anything.
//
// Every user-facing signature (the v3 user-intent message, transactions) flows
// through the browser wallet adapter (`useWallet()` -> signMessage) in usePerps.ts.
// Do not pass the user's wallet into MangoClient: the SDK's signing helpers expect
// a Node keypair shape and cannot drive Phantom/Solflare popups.
let cached: Promise<{ client: MangoClient; group: Group; connection: Connection }> | null = null;

export async function getMangoClientAndGroup(
  connection: Connection
): Promise<{ client: MangoClient; group: Group }> {
  if (cached) {
    const resolved = await cached;
    if (resolved.connection === connection) return resolved;
  }
  cached = (async () => {
    if (!config.devnet.mangoProgramId) {
      throw new Error('VITE_MANGO_PROGRAM_ID is not configured');
    }
    if (!config.devnet.mangoGroupPk) {
      throw new Error('VITE_MANGO_GROUP_PK is not configured');
    }
    const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), {
      commitment: 'confirmed',
    });
    const programId = new PublicKey(config.devnet.mangoProgramId);
    const client = await MangoClient.connect(provider, 'devnet', programId, {
      idsSource: 'get-program-accounts',
    });
    const group = await client.getGroup(new PublicKey(config.devnet.mangoGroupPk));
    return { client, group, connection };
  })();
  return cached;
}

export async function reloadMangoGroup(connection: Connection): Promise<Group> {
  cached = null;
  const { group } = await getMangoClientAndGroup(connection);
  return group;
}
