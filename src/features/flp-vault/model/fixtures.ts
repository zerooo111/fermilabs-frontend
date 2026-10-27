/**
 * Test fixtures: real data API responses (captured by
 * `node scripts/flp-fixtures.mjs`), parsed through the runtime schema, plus
 * helpers that derive the states the vaults aren't in right now.
 *
 * mainnet*.json are the RC6.1 mainnet vault (profile rc6), in pre-deposit
 * with public intake paused. live*.json are the RC6 devnet vault (profile
 * rc6-devnet) in its live phase. pre-deposit*.json are RC4 captures (profile
 * rc2-pr29, vault 3), an approved wallet with both principal and shares. The
 * envelope shape is the same (schema_version 1), and `rc6()` relabels one as
 * this deployment's reader's.
 */
import live from './__fixtures__/live.json';
import liveUser from './__fixtures__/live-user.json';
import mainnet from './__fixtures__/mainnet.json';
import mainnetNoUser from './__fixtures__/mainnet-nouser.json';
import mainnetUser from './__fixtures__/mainnet-user.json';
import pre from './__fixtures__/pre-deposit.json';
import preNoUser from './__fixtures__/pre-deposit-nouser.json';
import preUser from './__fixtures__/pre-deposit-user.json';
import type { FlpEnvelope } from './api';
import { FLP_API_PROFILE, FLP_PROGRAM_ID, FLP_VAULTS } from './config';
import { parseEnvelope } from './schema';

const load = (json: unknown) => () => parseEnvelope(structuredClone(json));

export const fixtures = {
  /** Vault 3 before graduation, no wallet. */
  pre: load(pre),
  /** Vault 3, an approved wallet with 4 FLP and 7 USDC pre-deposited. */
  preUser: load(preUser),
  /** Vault 3, a wallet with no Depositor record (`user: null`). */
  preNoUser: load(preNoUser),
  /** The RC6 devnet vault, live, no wallet. */
  live: load(live),
  /** The RC6 devnet vault, an approved wallet holding shares and no open request. */
  liveUser: load(liveUser),
  /** The mainnet vault before launch: approved deposits only, no wallet. */
  mainnet: load(mainnet),
  /** The mainnet vault, the approved funding wallet (no shares yet). */
  mainnetUser: load(mainnetUser),
  /** The mainnet vault, a wallet with no Depositor record (`user: null`). */
  mainnetNoUser: load(mainnetNoUser),
};

/** A fixture with some fields changed, for states the devnet vaults aren't in. */
export function edit(env: FlpEnvelope, change: (env: FlpEnvelope) => void): FlpEnvelope {
  const copy = structuredClone(env);
  change(copy);
  return copy;
}

/** `env` as this deployment's reader would label it: its profile, program and vault. */
export function rc6(env: FlpEnvelope): FlpEnvelope {
  return edit(env, e => {
    e.source.profile = FLP_API_PROFILE;
    e.source.program_id = FLP_PROGRAM_ID.toBase58();
    e.vault = FLP_VAULTS[0].address.toBase58();
  });
}
