/**
 * Dummy vault data for building the UI before the vaults API exists.
 *
 * Every vault is generated from a seed, so the numbers are the same on every
 * reload. Each vault gets one simulated share-price path, and APR and return
 * are computed from it, so the table and the chart agree.
 */
import type {
  Vault,
  VaultDepositor,
  VaultKind,
  VaultPoint,
  VaultPosition,
  VaultStatus,
  VaultTrade,
} from './types';

const DAY = 86_400;

const MARKETS: { symbol: string; price: number }[] = [
  { symbol: 'SOL-PERP', price: 182.44 },
  { symbol: 'BTC-PERP', price: 97_215.5 },
  { symbol: 'ETH-PERP', price: 3_418.2 },
  { symbol: 'JUP-PERP', price: 0.9214 },
  { symbol: 'WIF-PERP', price: 1.842 },
  { symbol: 'JTO-PERP', price: 2.611 },
];

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type Rng = ReturnType<typeof mulberry32>;

function gauss(rng: Rng): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function address(rng: Rng): string {
  let out = '';
  for (let i = 0; i < 44; i++) out += BASE58[Math.floor(rng() * BASE58.length)];
  return out;
}

function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

interface VaultSeed {
  seed: number;
  name: string;
  kind: VaultKind;
  status: VaultStatus;
  description: string;
  /** Holds offsetting longs and shorts. */
  hedged?: boolean;
  ageDays: number;
  tvl: number;
  /** Mean daily share-price return. */
  drift: number;
  /** Daily share-price volatility. */
  vol: number;
  leaderFee: number;
  leaderMinShare: number;
  lockupDays: number;
  depositorCount: number;
  /** Markets the strategy trades, by index into MARKETS. */
  markets: number[];
  /** The connected user's stake, if any. */
  user?: { equity: number; lockedDaysLeft: number };
}

const SEEDS: VaultSeed[] = [
  {
    seed: 11,
    name: 'Fermi Liquidity Provider',
    kind: 'protocol',
    status: 'open',
    description:
      'FLP places buy and sell orders on every Fermi market and takes over liquidated positions. Depositors share its profits and losses. No fees.',
    ageDays: 300,
    tvl: 18_420_000,
    drift: 0.00085,
    vol: 0.0048,
    leaderFee: 0,
    leaderMinShare: 0,
    lockupDays: 4,
    depositorCount: 6_231,
    markets: [0, 1, 2, 3, 4, 5],
    user: { equity: 12_480.52, lockedDaysLeft: 2 },
  },
  {
    seed: 23,
    name: 'Fermi Backstop',
    kind: 'protocol',
    status: 'open',
    description:
      'Takes over positions that cannot be closed on the order book. Quiet most days, earns more when markets move fast.',
    ageDays: 210,
    tvl: 4_150_000,
    drift: 0.0004,
    vol: 0.0032,
    leaderFee: 0,
    leaderMinShare: 0,
    lockupDays: 4,
    depositorCount: 1_184,
    markets: [0, 1, 2],
  },
  {
    seed: 37,
    name: 'Basis Harvest',
    hedged: true,
    kind: 'community',
    status: 'open',
    description:
      'Collects funding by holding matched longs and shorts. Small, steady gains with little price risk.',
    ageDays: 164,
    tvl: 2_310_400,
    drift: 0.0006,
    vol: 0.0019,
    leaderFee: 0.1,
    leaderMinShare: 0.05,
    lockupDays: 1,
    depositorCount: 842,
    markets: [0, 1, 2],
    user: { equity: 3_052.1, lockedDaysLeft: 0 },
  },
  {
    seed: 41,
    name: 'Kestrel Trend',
    kind: 'community',
    status: 'open',
    description:
      'Follows trends in BTC, ETH, SOL and WIF. Cuts losing trades early. Can go weeks without much happening.',
    ageDays: 128,
    tvl: 1_184_900,
    drift: 0.0011,
    vol: 0.0155,
    leaderFee: 0.1,
    leaderMinShare: 0.05,
    lockupDays: 1,
    depositorCount: 511,
    markets: [0, 1, 2, 4],
  },
  {
    seed: 53,
    name: 'Tidewater MM',
    kind: 'community',
    status: 'open',
    description: 'Places buy and sell orders on smaller markets and earns the difference.',
    ageDays: 96,
    tvl: 846_200,
    drift: 0.0009,
    vol: 0.0042,
    leaderFee: 0.15,
    leaderMinShare: 0.1,
    lockupDays: 2,
    depositorCount: 233,
    markets: [3, 4, 5],
  },
  {
    seed: 67,
    name: 'Meridian Macro',
    kind: 'community',
    status: 'open',
    description:
      'Trades BTC and ETH around big economic news like rate decisions and inflation data.',
    ageDays: 220,
    tvl: 612_750,
    drift: 0.0004,
    vol: 0.0121,
    leaderFee: 0.1,
    leaderMinShare: 0.05,
    lockupDays: 1,
    depositorCount: 309,
    markets: [1, 2],
  },
  {
    seed: 71,
    name: 'Low Orbit',
    kind: 'community',
    status: 'open',
    description: 'Short trades on SOL and JUP that bet on prices snapping back after big moves.',
    ageDays: 44,
    tvl: 208_300,
    drift: 0.0014,
    vol: 0.0088,
    leaderFee: 0.1,
    leaderMinShare: 0.05,
    lockupDays: 1,
    depositorCount: 97,
    markets: [0, 3],
  },
  {
    seed: 89,
    name: 'Night Shift',
    kind: 'community',
    status: 'closed',
    description:
      'Fast momentum trades during Asia hours. The manager paused new deposits after a bad month.',
    ageDays: 140,
    tvl: 131_050,
    drift: -0.0022,
    vol: 0.015,
    leaderFee: 0.2,
    leaderMinShare: 0.05,
    lockupDays: 1,
    depositorCount: 154,
    markets: [0, 4, 5],
    user: { equity: 418.33, lockedDaysLeft: 0 },
  },
];

function startOfTodayUtc(): number {
  const now = Math.floor(Date.now() / 1000);
  return now - (now % DAY);
}

/** Simulates share price and flows, then scales so the last value equals the seed TVL. */
function simulateHistory(rng: Rng, s: VaultSeed, end: number): VaultPoint[] {
  const raw: VaultPoint[] = [];
  let price = 1;
  let shares = s.tvl * 0.08;
  let pnl = 0;
  let prevValue = shares;

  for (let d = s.ageDays; d >= 0; d--) {
    const r = s.drift + s.vol * gauss(rng);
    price *= 1 + r;
    pnl += prevValue * r;
    // Deposits outpace withdrawals early on, then roughly balance out.
    const growth = d > s.ageDays * 0.3 ? 0.012 : 0.002;
    shares = Math.max(shares * (1 + growth + 0.01 * gauss(rng)), s.tvl * 0.02);
    const value = price * shares;
    raw.push({ time: end - d * DAY, value, pnl, sharePrice: price });
    prevValue = value;
  }

  const k = s.tvl / raw[raw.length - 1].value;
  return raw.map(p => ({ ...p, value: p.value * k, pnl: p.pnl * k }));
}

function apr(history: VaultPoint[], days: number): number {
  const last = history[history.length - 1];
  const from = history[Math.max(0, history.length - 1 - days)];
  const span = Math.max(1, (last.time - from.time) / DAY);
  return (last.sharePrice / from.sharePrice - 1) * (365 / span);
}

function positions(rng: Rng, s: VaultSeed): VaultPosition[] {
  const gross = s.tvl * (s.kind === 'protocol' ? 0.9 : 1.6);
  // A delta neutral book holds one long that offsets the shorts on the rest.
  const deltaNeutral = !!s.hedged;
  const weights = deltaNeutral
    ? s.markets.map((_, i) => (i === 0 ? s.markets.length - 1 : 1))
    : s.markets.map(() => 0.3 + rng());
  const total = weights.reduce((a, b) => a + b, 0);

  return s.markets.map((mi, i) => {
    const m = MARKETS[mi];
    const side = deltaNeutral ? (i === 0 ? 'long' : 'short') : rng() > 0.45 ? 'long' : 'short';
    const notional = (gross * weights[i]) / total;
    const move = 0.06 * gauss(rng);
    const entryPrice = m.price * (1 - move);
    const size = notional / m.price;
    const dir = side === 'long' ? 1 : -1;
    return {
      market: m.symbol,
      side,
      size,
      entryPrice,
      markPrice: m.price,
      unrealizedPnl: dir * size * (m.price - entryPrice),
    };
  });
}

function trades(rng: Rng, s: VaultSeed, end: number): VaultTrade[] {
  const now = end + DAY - 1800;
  let t = now;
  return Array.from({ length: 24 }, (_, i) => {
    const m = MARKETS[pick(rng, s.markets)];
    t -= Math.floor(300 + rng() * 5400);
    const closing = rng() > 0.55;
    return {
      id: `${s.seed}-${i}`,
      time: t,
      market: m.symbol,
      side: rng() > 0.5 ? 'buy' : 'sell',
      price: m.price * (1 + 0.004 * gauss(rng)),
      size: (s.tvl * (0.002 + rng() * 0.01)) / m.price,
      closedPnl: closing ? s.tvl * 0.0006 * gauss(rng) : null,
    };
  });
}

function depositors(rng: Rng, s: VaultSeed, leader: string): VaultDepositor[] {
  const rows: VaultDepositor[] = [
    {
      address: leader,
      equity: s.tvl * Math.max(s.leaderMinShare, 0.12),
      allTimePnl: s.tvl * 0.03 * (1 + rng()),
      isLeader: s.kind === 'community',
    },
  ];
  for (let i = 0; i < 11; i++) {
    const equity = s.tvl * (0.004 + rng() * 0.05);
    rows.push({
      address: address(rng),
      equity,
      allTimePnl: equity * (s.drift * 40 + 0.08 * gauss(rng)),
      isLeader: false,
    });
  }
  return rows.sort((a, b) => b.equity - a.equity);
}

function build(s: VaultSeed, end: number): Vault {
  const rng = mulberry32(s.seed);
  const id = address(rng);
  const leader = address(rng);
  const history = simulateHistory(rng, s, end);
  const last = history[history.length - 1];

  return {
    id,
    name: s.name,
    kind: s.kind,
    status: s.status,
    leader,
    description: s.description,
    createdAt: history[0].time,
    tvl: s.tvl,
    apr30d: apr(history, 30),
    allTimeReturn: last.sharePrice - 1,
    sharePrice: last.sharePrice,
    leaderFee: s.leaderFee,
    lockupDays: s.lockupDays,
    depositorCount: s.depositorCount,
    history,
    positions: positions(rng, s),
    trades: trades(rng, s, end),
    depositors: depositors(rng, s, leader),
    user: s.user
      ? {
          equity: s.user.equity,
          allTimePnl: s.user.equity * (last.sharePrice - 1) * 0.6,
          unlocksAt:
            s.user.lockedDaysLeft > 0 ? end + s.user.lockedDaysLeft * DAY + 9 * 3600 : end - DAY,
        }
      : null,
  };
}

let cache: Vault[] | null = null;

export function getMockVaults(): Vault[] {
  if (!cache) {
    const end = startOfTodayUtc();
    cache = SEEDS.map(s => build(s, end));
  }
  return cache;
}
