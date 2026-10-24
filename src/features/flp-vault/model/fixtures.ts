/**
 * Test fixtures: real data API responses (captured by
 * `node scripts/flp-fixtures.mjs`), parsed through the runtime schema, plus
 * helpers that derive the states the devnet vaults aren't in right now.
 */
import live from './__fixtures__/live.json';
import liveUser from './__fixtures__/live-user.json';
import pre from './__fixtures__/pre-deposit.json';
import preNoUser from './__fixtures__/pre-deposit-nouser.json';
import preUser from './__fixtures__/pre-deposit-user.json';
import type { FlpEnvelope } from './api';
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
