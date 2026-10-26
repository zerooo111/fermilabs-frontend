/**
 * Test fixtures: real data API responses (captured by
 * `node scripts/flp-fixtures.mjs`), parsed through the runtime schema, plus
 * helpers that derive the states the devnet vaults aren't in right now.
 *
 * These are RC4 captures (profile rc2-pr29, vaults 3 and 1): the envelope
 * shape is the same (schema_version 1), and `rc6()` relabels one as the RC6
 * reader's. Re-capture from the RC6 vault once the data API serves it.
 */
import live from './__fixtures__/live.json';
import liveUser from './__fixtures__/live-user.json';
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
  /** Vault 1 after graduation, no wallet. */
  live: load(live),
  /** Vault 1, a wallet holding shares and no open request. */
  liveUser: load(liveUser),
};

/** A fixture with some fields changed, for states the devnet vaults aren't in. */
export function edit(env: FlpEnvelope, change: (env: FlpEnvelope) => void): FlpEnvelope {
  const copy = structuredClone(env);
  change(copy);
  return copy;
}

/** `env` as the RC6 reader would label it: this deployment's profile, program and vault. */
export function rc6(env: FlpEnvelope): FlpEnvelope {
  return edit(env, e => {
    e.source.profile = FLP_API_PROFILE;
    e.source.program_id = FLP_PROGRAM_ID.toBase58();
    e.vault = FLP_VAULTS[0].address.toBase58();
  });
}
