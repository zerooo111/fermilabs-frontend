import { describe, expect, it } from 'vitest';
import { MAX_BASKET_LEGS, describeLeg, parseQuickOrder, type QuickOrderMarket } from './parse';

const MARKETS: QuickOrderMarket[] = [
  { id: '0', symbol: 'SOL-PERP', base: 'SOL' },
  { id: '1', symbol: 'BTC-PERP', base: 'BTC' },
  { id: '2', symbol: 'ETH-PERP', base: 'ETH' },
  { id: '3', symbol: 'JLP-PERP', base: 'JLP' },
  { id: '4', symbol: 'BNB-PERP', base: 'BNB' },
];

const parse = (input: string) => parseQuickOrder(input, MARKETS);

/** The single leg of a command expected to parse cleanly. */
function onlyLeg(input: string) {
  const result = parse(input);
  expect(result.error).toBeNull();
  expect(result.legs).toHaveLength(1);
  const [leg] = result.legs;
  if (!leg.ok) throw new Error(`expected "${input}" to parse: ${leg.error}`);
  return leg.leg;
}

/** The error of a command expected to fail on its first leg. */
function legError(input: string) {
  const [leg] = parse(input).legs;
  if (leg.ok) throw new Error(`expected "${input}" to fail`);
  return leg.error;
}

describe('parseQuickOrder sides', () => {
  it('reads long/short, buy/sell and the one-letter aliases', () => {
    for (const word of ['long', 'l', 'buy', 'b', 'LONG', 'Buy']) {
      expect(onlyLeg(`${word} 2 SOL`).side).toBe('Buy');
    }
    for (const word of ['short', 's', 'sell', 'SHORT', 'Sell']) {
      expect(onlyLeg(`${word} 2 SOL`).side).toBe('Sell');
    }
  });

  it('rejects a leg that does not start with a side', () => {
    expect(legError('2 SOL')).toMatch(/Start with long or short/);
    expect(legError('yolo 2 SOL')).toMatch(/Start with long or short/);
  });
});

describe('parseQuickOrder sizes', () => {
  it('reads decimals and comma-grouped thousands', () => {
    expect(onlyLeg('long 0.5 BTC').size).toBe(0.5);
    expect(onlyLeg('long .25 BTC').size).toBe(0.25);
    expect(onlyLeg('long 1,000 JLP').size).toBe(1000);
    expect(onlyLeg('long 1,250,000.5 JLP').size).toBe(1250000.5);
  });

  it('does not split a leg on a thousands separator', () => {
    const result = parse('long 1,000 JLP, short 2 BTC');
    expect(result.valid).toBe(true);
    expect(result.legs).toHaveLength(2);
  });

  it('rejects sizes that are not numbers, zero or missing', () => {
    expect(legError('long 1.2.3 SOL')).toMatch(/not a valid size/);
    expect(legError('long 0 SOL')).toMatch(/not a valid size/);
    expect(legError('long SOL 2')).toMatch(/Expected a size/);
    expect(legError('long')).toMatch(/Add a size and a market/);
    expect(legError('long 2')).toMatch(/Add a market after the size/);
  });
});

describe('parseQuickOrder symbols', () => {
  it('matches case-insensitively, with or without the perp suffix', () => {
    expect(onlyLeg('long 2 sol').market.id).toBe('0');
    expect(onlyLeg('long 2 SOL-PERP').market.id).toBe('0');
    expect(onlyLeg('long 2 sol-perp').market.id).toBe('0');
    expect(onlyLeg('long 2SOL').market.id).toBe('0');
  });

  it('resolves spoken aliases and unique prefixes', () => {
    expect(onlyLeg('long 2 solana').market.id).toBe('0');
    expect(onlyLeg('short 0.1 bitcoin').market.id).toBe('1');
    expect(onlyLeg('long 1 jl').market.id).toBe('3');
  });

  it('refuses an ambiguous prefix instead of guessing', () => {
    expect(legError('long 1 B')).toMatch(/matches BTC, BNB/);
  });

  it('names the closest base for an unknown symbol', () => {
    expect(legError('long 1 SOLL')).toMatch(/did you mean SOL\?/);
    expect(legError('long 1 XYZ')).toBe('No market called "XYZ"');
  });
});

describe('parseQuickOrder commands', () => {
  it('is empty for blank input', () => {
    expect(parse('')).toEqual({ legs: [], error: null, valid: false });
    expect(parse('  ,  ')).toEqual({ legs: [], error: null, valid: false });
  });

  it('parses the example basket', () => {
    const result = parse('long 2 SOL, long 1 BTC, long 100 JLP');
    expect(result.valid).toBe(true);
    expect(result.legs.map(l => (l.ok ? describeLeg(l.leg) : l.error))).toEqual([
      'Long 2 SOL',
      'Long 1 BTC',
      'Long 100 JLP',
    ]);
  });

  it('ignores trailing and doubled commas', () => {
    const result = parse('long 2 SOL,, short 1 ETH,  ');
    expect(result.valid).toBe(true);
    expect(result.legs).toHaveLength(2);
  });

  it('reports every leg even when one is broken', () => {
    const result = parse('long 2 SOL, short 1 NOPE');
    expect(result.valid).toBe(false);
    expect(result.legs[0].ok).toBe(true);
    expect(result.legs[1].ok).toBe(false);
  });

  it('caps the basket with a clear message but still shows the legs', () => {
    const input = Array.from({ length: MAX_BASKET_LEGS + 1 }, () => 'long 1 SOL').join(', ');
    const result = parse(input);
    expect(result.error).toBe(
      `Up to ${MAX_BASKET_LEGS} orders per command — you typed ${MAX_BASKET_LEGS + 1}`
    );
    expect(result.valid).toBe(false);
    expect(result.legs).toHaveLength(MAX_BASKET_LEGS + 1);
  });
});
