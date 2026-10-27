import { describe, expect, it } from 'vitest';

import {
  describeFlpError,
  fixedScaled,
  fixedToNative,
  formatPeriod,
  formatPrice,
  formatUnits,
  isWalletRejection,
  parseUnits,
  sharePrice,
  toInputString,
} from './format';

const q48 = (n: bigint) => ({ raw: (n << 48n).toString(), fractionalBits: 48 });

describe('native units', () => {
  it('parses decimal input exactly, or rejects it', () => {
    expect(parseUnits('1.5', 6)).toBe(1_500_000n);
    expect(parseUnits('.5', 6)).toBe(500_000n);
    expect(parseUnits('0', 6)).toBe(0n);
    expect(parseUnits('', 6)).toBeNull();
    expect(parseUnits('1.1234567', 6)).toBeNull();
    expect(parseUnits('1e3', 6)).toBeNull();
  });

  it('formats with grouping, trimming and sign', () => {
    expect(formatUnits(1_234_567_890n, 6, 2)).toBe('1,234.56');
    expect(formatUnits(1_500_000n, 6)).toBe('1.5');
    expect(formatUnits(-1_500_000n, 6)).toBe('-1.5');
    expect(formatUnits(0n, 6)).toBe('0');
  });

  it('round-trips through the input field', () => {
    expect(toInputString(1_500_000n, 6)).toBe('1.5');
    expect(parseUnits(toInputString(123_456_789n, 6), 6)).toBe(123_456_789n);
  });
});

describe('fixed-point values', () => {
  it('converts Q48 to native units, rounding down', () => {
    expect(fixedToNative(q48(5n))).toBe(5n);
    // -1.5 rounds toward -infinity.
    expect(fixedToNative({ raw: (-(3n << 47n)).toString(), fractionalBits: 48 })).toBe(-2n);
  });

  it('scales ratios such as oracle prices', () => {
    // 100 native quote per native base, with 6 base decimals: 100 USDC per base.
    expect(fixedScaled(q48(100n), 6)).toBe(100_000_000n);
  });
});

describe('share price', () => {
  it('uses the program’s virtual offsets (integration guide 5.4 example)', () => {
    const price = sharePrice(1_222_533_577n, 1_219_149_198n);
    expect(formatPrice(price, 6)).toMatch(/^1\.0027/);
  });

  it('is 1 for a vault whose NAV equals its supply', () => {
    expect(sharePrice(332_000_000n, 332_000_000n)).toBe(1_000_000n);
  });
});

describe('copy helpers', () => {
  it('names epoch lengths in words', () => {
    expect(formatPeriod(300)).toBe('5 min');
    expect(formatPeriod(3600)).toBe('1 hour');
    expect(formatPeriod(86_400)).toBe('24 hours');
  });
});

describe('describeFlpError', () => {
  it('maps actionable program errors to plain sentences', () => {
    expect(describeFlpError(new Error('custom program error: 0x1791'))).toMatch(/not approved/);
    expect(describeFlpError(new Error('{"InstructionError":[1,{"Custom":6042}]}'))).toMatch(
      /still being processed/
    );
    expect(describeFlpError(new Error('AnchorError ... Error Number: 6010.'))).toMatch(/cutoff/);
  });

  it('turns other IDL errors into a sentence without the Rust name', () => {
    expect(describeFlpError(new Error('custom program error: 0x177c'))).toBe(
      'The current epoch has not ended.'
    );
  });

  it('treats wallet rejection as a cancel, not an error', () => {
    const err = new Error('User rejected the request.');
    expect(isWalletRejection(err)).toBe(true);
    expect(describeFlpError(err)).toBe('Cancelled in wallet');
    expect(isWalletRejection(new Error('Blockhash not found'))).toBe(false);
  });
});
