import { describe, expect, it } from 'vitest';

import {
  assertEnoughSol,
  hasEnoughSol,
  InsufficientSolError,
  readLamports,
  requiredLamports,
  SOL_FEE_BUFFER,
  SOL_FOR_NEW_ACCOUNT,
} from './gas';

const newAccount = { needsAccountCreation: true };
const feesOnly = { needsAccountCreation: false };

describe('gas', () => {
  it('asks for account rent on a first deposit and fees only afterwards', () => {
    expect(requiredLamports(newAccount)).toBe(SOL_FOR_NEW_ACCOUNT * 1e9);
    expect(requiredLamports(feesOnly)).toBe(SOL_FEE_BUFFER * 1e9);
  });

  it('accepts the exact requirement and both lamport types', () => {
    expect(hasEnoughSol(requiredLamports(feesOnly), feesOnly)).toBe(true);
    expect(hasEnoughSol(BigInt(requiredLamports(feesOnly)) - 1n, feesOnly)).toBe(false);
    expect(hasEnoughSol(requiredLamports(feesOnly), newAccount)).toBe(false);
  });

  it('carries the numbers the forms show, and the user-facing wording', () => {
    expect(() => assertEnoughSol(40_000_000, newAccount)).not.toThrow();
    try {
      assertEnoughSol(0, newAccount);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientSolError);
      const e = err as InsufficientSolError;
      expect(e.requiredSol).toBe(SOL_FOR_NEW_ACCOUNT);
      expect(e.balanceSol).toBe(0);
      expect(e.message).toBe(
        'You need about 0.04 SOL in your wallet to create your margin account and cover network fees. You have 0 SOL.'
      );
    }
  });

  it('lets an unknown balance through, and reads a failed RPC as unknown', async () => {
    expect(() => assertEnoughSol(null, newAccount)).not.toThrow();
    const failing = { getBalance: () => Promise.reject(new Error('429')) };
    const owner = {} as Parameters<typeof readLamports>[1];
    await expect(readLamports(failing as never, owner)).resolves.toBeNull();
    const ok = { getBalance: () => Promise.resolve(5) };
    await expect(readLamports(ok as never, owner)).resolves.toBe(5);
  });
});
