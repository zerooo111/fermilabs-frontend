import { describe, expect, it } from 'vitest';

import { PublicKey } from '@solana/web3.js';

import type { FlpVaultConfig } from '@/features/flp-vault';
import { edit, fixtures } from '@/features/flp-vault/model/fixtures';

import { flpToVault } from './flpSource';

// The fixtures' vaults (fixtures.ts): the RC6 devnet vault, and RC4 vault 3
// for an approved wallet holding both principal and shares.
const config = (id: number, address: string): FlpVaultConfig => ({
  id,
  address: new PublicKey(address),
  name: `Vault ${id}`,
});
const live = config(1, 'DSF7hKayWatQyRhuyr4UkrG3zUuNW6b1Q5VhW7BzrUhu');
const pre = config(3, '8fAqhdnBWnCN2nkkkX4qhU316bhhsvAtKRfoCAv1Hmgo');

describe('flpToVault', () => {
  it('attaches the user only for the wallet it was read for', () => {
    const env = fixtures.liveUser();
    const owner = env.owner!;
    expect(flpToVault(live, env, '30d', owner).user?.shares).toBeGreaterThan(0);
    // Another wallet, or no wallet: never this wallet's position.
    expect(
      flpToVault(live, env, '30d', 'SomeOtherWallet1111111111111111111111111111').user
    ).toBeUndefined();
    expect(flpToVault(live, env, '30d', undefined).user).toBeUndefined();
  });

  it('a wallet without a Depositor record has no position (null, not loading)', () => {
    const env = fixtures.preNoUser();
    expect(flpToVault(pre, env, '30d', env.owner!).user).toBeNull();
  });

  it('counts pre-deposited principal in the balance', () => {
    const env = fixtures.preUser();
    const user = flpToVault(pre, env, '30d', env.owner!).user!;
    // 4 FLP at ~1.00 plus 7 USDC in escrow.
    expect(user.equity).toBeCloseTo(11, 1);
  });

  it('counts a queued deposit in the balance, as USDC, but not in earnings', () => {
    const base = fixtures.liveUser();
    const before = flpToVault(live, base, '30d', base.owner!).user!;
    const env = edit(base, e => {
      e.data.user!.deposit = {
        ...e.data.user!.deposit,
        state: 'queued',
        ticket: {
          requestId: '7',
          epoch: e.data.epoch.requestTarget,
          amount: '25000000',
          aux: '25000000',
        },
        cancellable: true,
      };
    });
    const user = flpToVault(live, env, '30d', env.owner!).user!;
    expect(user.equity - before.equity).toBeCloseTo(25, 6);
    expect(user.pending_deposit).toBe(25);
    expect(user.all_time_pnl).toBe(before.all_time_pnl);
  });

  it('counts settled deposit shares once (they are in the invested shares)', () => {
    const base = fixtures.liveUser();
    const before = flpToVault(live, base, '30d', base.owner!).user!;
    // The API adds settled, unclaimed deposit shares to the invested shares.
    const env = edit(base, e => {
      const u = e.data.user!;
      u.deposit = { ...u.deposit, state: 'claimable-shares', claimable: '5000000' };
      u.investedSharesIncludingOwedAndUnfunded = String(
        BigInt(u.investedSharesIncludingOwedAndUnfunded) + 5_000_000n
      );
      u.pnl.currentUnrealized = { value: null, reason: 'priced from the share price' };
    });
    const user = flpToVault(live, env, '30d', env.owner!).user!;
    const price = flpToVault(live, env, '30d', env.owner!).share_price;
    expect(user.claimable).toBeCloseTo(5 * price, 6);
    expect(user.equity).toBeCloseTo(before.shares * price + 5 * price, 6);
  });

  it('keeps unknowns unknown: no NAV means no TVL and no vault PnL', () => {
    const env = edit(fixtures.live(), e => {
      e.data.valuation.currentNav.value = null;
    });
    const v = flpToVault(live, env, '30d', undefined);
    expect(v.tvl).toBeNull();
    expect(v.all_time_pnl).toBeNull();
  });

  it('keeps unpriced unrealized PnL out of the user’s earnings', () => {
    const env = edit(fixtures.liveUser(), e => {
      e.data.user!.pnl.currentUnrealized = { value: null, reason: 'no marks' };
    });
    expect(flpToVault(live, env, '30d', env.owner!).user?.all_time_pnl).toBeNull();
  });

  it('opens Deposit for an approved wallet during a public-only pause', () => {
    const env = edit(fixtures.preUser(), e => {
      e.data.lifecycle.publicDepositsPaused = true;
      e.data.user!.availability.publicDepositsBlockedByStatus = true;
    });
    expect(flpToVault(pre, env, '30d', env.owner!).deposits_open).toBe(true);
    // A wallet that isn't approved can't.
    const anon = edit(fixtures.pre(), e => {
      e.data.lifecycle.publicDepositsPaused = true;
    });
    expect(flpToVault(pre, anon, '30d', undefined).deposits_open).toBe(false);
  });
});
