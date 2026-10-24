import { describe, expect, it } from 'vitest';

import { edit, fixtures } from './fixtures';
import { parseEnvelope } from './schema';
import {
  availability,
  depositRoutes,
  ticketBlocks,
  upnlRisk,
  vaultView,
  withdrawRoutes,
} from './view';

const routes = (list: Array<{ route: string; closed: string | null }>) =>
  list.map(r => (r.closed ? `${r.route}(closed)` : r.route));

describe('schema', () => {
  it('accepts every captured response', () => {
    for (const load of Object.values(fixtures)) expect(() => load()).not.toThrow();
  });

  it('names the field that changed', () => {
    const broken = edit(fixtures.live(), env => {
      (env.data.lifecycle as { mode: string }).mode = 'paused';
    });
    expect(() => parseEnvelope(broken)).toThrow(/data\.lifecycle\.mode/);
  });
});

describe('vaultView', () => {
  it('values the vault as NAV plus escrow, at a 6-decimal share price', () => {
    const v = vaultView(fixtures.pre());
    expect(v.tvl).not.toBeNull();
    expect(v.tvl! >= v.escrow).toBe(true);
    expect(v.price > 900_000n && v.price < 1_100_000n).toBe(true);
  });

  it('leaves TVL unknown when the API can’t value the vault', () => {
    const env = edit(fixtures.live(), e => {
      e.data.valuation.currentNav.value = null;
    });
    expect(vaultView(env).tvl).toBeNull();
  });
});

describe('deposit routes', () => {
  it('pre-deposit: escrow for everyone, direct for approved wallets', () => {
    expect(routes(depositRoutes(fixtures.pre(), undefined))).toEqual(['pre-deposit']);
    const env = fixtures.preUser();
    expect(routes(depositRoutes(env, env.data.user))).toEqual(['pre-deposit', 'direct']);
  });

  it('live: a queued request', () => {
    expect(routes(depositRoutes(fixtures.live(), undefined))).toEqual(['queued']);
  });

  it('a public-only pause keeps direct deposits open (guide B.2 rule 19)', () => {
    const env = edit(fixtures.preUser(), e => {
      e.data.lifecycle.publicDepositsPaused = true;
      e.data.user!.availability.publicDepositsBlockedByStatus = true;
    });
    expect(routes(depositRoutes(env, env.data.user))).toEqual(['pre-deposit(closed)', 'direct']);
    expect(availability(env, env.data.user, 0n).canDeposit).toBe(true);
  });
});

describe('withdraw routes', () => {
  it('pre-deposit, approved wallet with principal and shares: all three', () => {
    const env = fixtures.preUser();
    expect(routes(withdrawRoutes(env, env.data.user, 4_000_000n))).toEqual([
      'refund',
      'instant',
      'queued',
    ]);
  });

  it('only routes the wallet has a balance for, once the wallet is known', () => {
    const env = fixtures.preNoUser();
    expect(withdrawRoutes(env, null, 0n)).toEqual([]);
    expect(availability(env, null, 0n)).toMatchObject({
      canWithdraw: false,
      withdrawReason: 'Nothing to withdraw',
    });
    // Before the wallet's read lands, every route the phase allows.
    expect(routes(withdrawRoutes(fixtures.pre(), undefined, 0n))).toEqual(['refund']);
  });

  it('live: a queued request for a wallet with shares', () => {
    const env = fixtures.liveUser();
    expect(routes(withdrawRoutes(env, env.data.user, 4_974_380n))).toEqual(['queued']);
  });

  it('unwind: no new requests, with the reason', () => {
    const env = edit(fixtures.liveUser(), e => {
      e.data.lifecycle.mode = 'unwind';
    });
    const a = availability(env, env.data.user, 4_974_380n);
    expect(a.canWithdraw).toBe(false);
    expect(a.withdrawReason).toMatch(/unwinding/);
  });
});

describe('ticketBlocks', () => {
  const user = () => fixtures.liveUser().data.user!;
  it('lets a request join a queued ticket for the same epoch only', () => {
    const t = user().deposit;
    expect(ticketBlocks(t, 10n)).toBe(false);
    const queued = { ...t, state: 'queued' as const, ticket: { ...t.ticket, epoch: '10' } };
    expect(ticketBlocks(queued, 10n)).toBe(false);
    expect(ticketBlocks(queued, 11n)).toBe(true);
    expect(ticketBlocks({ ...queued, state: 'claimable-shares' }, 10n)).toBe(true);
  });
});

describe('upnlRisk', () => {
  it('carries the disclosure a deposit form must show', () => {
    const risk = upnlRisk(fixtures.live());
    expect(risk?.disclosure).toMatch(/counted at par when you enter/);
    expect(typeof risk?.bps).toBe('number');
  });
});
