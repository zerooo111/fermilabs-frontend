import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Group, MangoAccount, MangoClient } from '@blockworks-foundation/mango-v4';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { config } from '@/shared/config/constants';
import type { ServerConfig } from '@/entities/server';

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

function clusterFromConfig(serverConfig: ServerConfig | null): 'mainnet-beta' | 'devnet' {
  if (serverConfig?.cluster === 'mainnet-beta') return 'mainnet-beta';
  return 'devnet';
}

export async function getMangoClientAndGroup(
  connection: Connection,
  serverConfig: ServerConfig | null = null
): Promise<{ client: MangoClient; group: Group }> {
  if (cached) {
    const resolved = await cached;
    if (resolved.connection === connection) return resolved;
  }
  const programIdStr = serverConfig?.program_id ?? config.devnet.mangoProgramId;
  const groupPkStr = serverConfig?.group ?? config.devnet.mangoGroupPk;
  if (!programIdStr) throw new Error('Mango program ID is not configured');
  if (!groupPkStr) throw new Error('Mango group PK is not configured');

  cached = (async () => {
    const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), {
      commitment: 'confirmed',
    });
    const programId = new PublicKey(programIdStr);
    const cluster = clusterFromConfig(serverConfig);
    const client = await MangoClient.connect(provider, cluster, programId, {
      idsSource: 'get-program-accounts',
      // Skip the api.mngo.cloud price-impact fetch — it has no devnet data and hangs
      // for the OS TCP timeout (~75s) on networks where mngo.cloud is unreachable.
      // We don't use price-impact data; canonical remaining-accounts only need group
      // structure (banks, perp markets, oracles), which is read straight from chain.
      turnOffPriceImpactLoading: true,
    });
    const group = await client.getGroup(new PublicKey(groupPkStr));
    return { client, group, connection };
  })();
  return cached;
}

// sha256("account:FermiAccount")[..8] / sha256("account:MangoAccount")[..8]. The
// program renamed its user account (naming-migration.md §2) but the layout after
// the discriminator is unchanged. The upstream SDK decodes with its bundled IDL
// ('mangoAccount'), so swap the discriminator back before handing it the bytes.
const FERMI_ACCOUNT_DISCRIMINATOR = Uint8Array.from([245, 36, 51, 8, 90, 127, 231, 244]);
const MANGO_ACCOUNT_DISCRIMINATOR = Uint8Array.from([243, 228, 247, 3, 169, 52, 175, 31]);

export async function fetchFermiAccount(
  client: MangoClient,
  connection: Connection,
  accountPk: PublicKey
): Promise<MangoAccount> {
  const ai = await connection.getAccountInfo(accountPk);
  if (!ai) throw new Error(`Fermi account ${accountPk.toBase58()} not found`);
  if (!FERMI_ACCOUNT_DISCRIMINATOR.every((b, i) => ai.data[i] === b)) {
    throw new Error(`Account ${accountPk.toBase58()} is not a FermiAccount`);
  }
  const data = Buffer.from(ai.data);
  data.set(MANGO_ACCOUNT_DISCRIMINATOR, 0);
  return client.getMangoAccountFromAi(accountPk, { ...ai, data });
}

export async function reloadMangoGroup(
  connection: Connection,
  serverConfig: ServerConfig | null = null
): Promise<Group> {
  cached = null;
  const { group } = await getMangoClientAndGroup(connection, serverConfig);
  return group;
}
