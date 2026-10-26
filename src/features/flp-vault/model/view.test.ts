import { describe, expect, it } from 'vitest';

import { FLP_VAULTS } from './config';
import { edit, fixtures, rc6 } from './fixtures';
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

  it('takes a vault read only from the RC6 reader for that vault', () => {
    const vault = FLP_VAULTS[0].address.toBase58();
    expect(() => parseEnvelope(fixtures.live(), vault)).not.toThrow();
    // An RC4 reader (profile rc2-pr29) must not stand in for RC6.
    expect(() => parseEnvelope(fixtures.pre(), vault)).toThrow(/rc2-pr29/);
    expect(() => parseEnvelope(rc6(fixtures.pre()), vault)).not.toThrow();
    expect(() => parseEnvelope(fixtures.live(), fixtures.pre().vault)).toThrow(
      /another program or vault/
    );
  });
});

describe('funding window', () => {
  const window = {
    closedEpoch: '8',
    scheduledStart: '1792993450',
    deadline: '1792993750',
    eligible: true,
    authenticated: true,
    current: true,
    open: true,
  };
  const withWindow = (change: Partial<typeof window> = {}, stale = false) =>
    edit(fixtures.live(), e => {
      e.data.fundingWindow = { ...window, ...change };
      e.cache = { hit: true, age_ms: 0, stale };
    });

  it('shows an open window only on current, eligible evidence from a fresh read', () => {
    expect(vaultView(withWindow()).funding).toEqual({ deadline: 1792993750 });
    expect(vaultView(withWindow({ current: false })).funding).toBeNull();
    expect(vaultView(withWindow({ eligible: false })).funding).toBeNull();
    expect(vaultView(withWindow({ open: false })).funding).toBeNull();
    // A stale copy claims nothing until a fresh read succeeds.
    expect(vaultView(withWindow({}, true)).funding).toBeNull();
    // RC4 had no FundingWindow PDA.
    expect(vaultView(fixtures.pre()).funding).toBeNull();
  });
});

describe('vaultView', () => {
  it('values the vault as NAV plus escrow, at a 6-decimal share price', () => {
    const v = vaultView(fixtures.pre());
    expect(v.tvl).not.toBeNull();
    expect(v.tvl! >= v.escrow).toBe(true);
    expect(v.price > 900_000n && v.price < 1_100_000n).toBe(true);
  });

  it('counts a queued deposit in TVL but not as profit', () => {
    const before = vaultView(fixtures.live());
    const queued = vaultView(
      edit(fixtures.live(), e => {
        const seg = e.data.valuation.segregated;
        seg.depositEscrowBalance = String(BigInt(seg.depositEscrowBalance) + 25_000_000n);
        seg.queuedDepositGross = String(BigInt(seg.queuedDepositGross) + 25_000_000n);
      })
    );
    expect(queued.tvl! - before.tvl!).toBe(25_000_000n);
    expect(queued.tvl! - queued.netIn).toBe(before.tvl! - before.netIn);
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

  it('keeps the disclosure when the amount is unknown, and reads the notice tiers', () => {
    const risk = upnlRisk(
      edit(fixtures.live(), e => {
        const r = e.data.standingUpnlRisk!;
        r.grossPositiveUnsettledPnlQuoteNative = { value: null, reason: 'Oracle marks are stale' };
        r.upnlToNavRatio = { value: null, reason: 'Oracle marks are stale' };
        r.monitor = {
          tier1: { status: 'duration-unknown' },
          tier2: { status: 'page-operator', triggers: ['single-market-upnl-at-least-500bps'] },
        };
      })
    );
    expect(risk).toMatchObject({ amount: null, bps: null, reason: 'Oracle marks are stale' });
    expect(risk?.disclosure).toMatch(/counted at par when you enter/);
    // A tier-2 condition still applies when the duration history is unknown.
    expect(risk?.notice).toBe('page-operator');
    expect(risk?.durationUnknown).toBe(true);
  });
});
