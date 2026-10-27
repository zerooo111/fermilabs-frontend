import { describe, expect, it } from 'vitest';

import type { Orderbook, OrderbookItem } from '@/entities/orderbook';
import { processOrderbook, type AggregatedOrder } from './processOrderbook';

/** Prices are scaled by 2 quote decimals here, so 99.30 is 9930 and a tick of 1 is 100 raw. */
const QUOTE_DECIMALS = 2;

const book = (overrides: Partial<Orderbook>): Orderbook => ({
  asks: [],
  bids: [],
  lastUpdateId: 1,
  lastUpdated: new Date(0),
  depthMode: 'level',
  ...overrides,
});

const level = (price: number, quantity: number): OrderbookItem => ({ price, quantity });

/** The built rows as price/size pairs, dropping the padding and the display-only fields. */
const rows = (side: (AggregatedOrder | null)[]) =>
  side
    .filter((o): o is AggregatedOrder => o !== null)
    .map(({ price, quantity }) => ({ price, quantity }));

describe('processOrderbook price grouping', () => {
  it('collapses bids onto the multiple below and sums their size', () => {
    const processed = processOrderbook(
      book({ bids: [level(9980, 1), level(9940, 2), level(9930, 3)] }),
      12,
      1,
      QUOTE_DECIMALS
    );

    expect(rows(processed.buys)).toEqual([{ price: 9900, quantity: 6 }]);
    expect(processed.buys[0]?.levelQuantity).toBe(6);
    // Notional keeps each order's own price: 9980*1 + 9940*2 + 9930*3.
    expect(processed.buys[0]?.total.toString()).toBe('59650');
  });

  it('collapses asks onto the multiple above', () => {
    const processed = processOrderbook(
      book({ asks: [level(10010, 1), level(10030, 2), level(10100, 4)] }),
      12,
      1,
      QUOTE_DECIMALS
    );

    expect(rows(processed.sells)).toEqual([{ price: 10100, quantity: 7 }]);
  });

  it('keeps separate rows for quotes in different buckets', () => {
    const processed = processOrderbook(
      book({ bids: [level(9980, 1), level(9940, 2), level(9850, 4), level(9710, 8)] }),
      12,
      1,
      QUOTE_DECIMALS
    );

    expect(rows(processed.buys)).toEqual([
      { price: 9900, quantity: 3 },
      { price: 9800, quantity: 4 },
      { price: 9700, quantity: 8 },
    ]);
  });

  it('groups by a sub-unit tick as well', () => {
    const processed = processOrderbook(
      book({ bids: [level(9938, 1), level(9931, 2), level(9929, 4)] }),
      12,
      0.1,
      QUOTE_DECIMALS
    );

    expect(rows(processed.buys)).toEqual([
      { price: 9930, quantity: 3 },
      { price: 9920, quantity: 4 },
    ]);
  });

  it('re-accumulates running totals in cumulative mode', () => {
    const processed = processOrderbook(
      book({
        depthMode: 'cumulative',
        // Server sends running totals: 1, 3, 7, 15.
        bids: [level(9980, 1), level(9940, 3), level(9850, 7), level(9710, 15)],
      }),
      12,
      1,
      QUOTE_DECIMALS
    );

    expect(rows(processed.buys)).toEqual([
      { price: 9900, quantity: 3 },
      { price: 9800, quantity: 7 },
      { price: 9700, quantity: 15 },
    ]);
    // The bucket's own size drives the row flash; the displayed quantity stays cumulative.
    expect(processed.buys.map(o => o?.levelQuantity)).toEqual([
      3,
      4,
      8,
      ...Array(9).fill(undefined),
    ]);
    expect(processed.buys[1]?.total.toString()).toBe(String(9980 * 1 + 9940 * 2 + 9850 * 4));
  });

  it('leaves per-level output untouched with no grouping', () => {
    const bids = [level(9980, 1), level(9940, 2), level(9930, 3)];
    const processed = processOrderbook(book({ bids }), 12, 0, QUOTE_DECIMALS);

    expect(rows(processed.buys)).toEqual(bids);
    expect(processed.buys[0]?.total.toString()).toBe('9980');
  });

  it('caps each side at maxRows and pads the rest with nulls', () => {
    const bids = [level(9980, 1), level(9870, 2), level(9760, 3), level(9650, 4)];
    const processed = processOrderbook(book({ bids }), 2, 1, QUOTE_DECIMALS);

    expect(processed.buys).toHaveLength(2);
    expect(rows(processed.buys)).toEqual([
      { price: 9900, quantity: 1 },
      { price: 9800, quantity: 2 },
    ]);
  });

  it('reads the spread off the raw best bid and ask, whatever the grouping', () => {
    const raw = book({
      bids: [level(9940, 2), level(9980, 1)],
      asks: [level(10030, 2), level(10010, 1)],
    });

    expect(processOrderbook(raw, 12, 0, QUOTE_DECIMALS).spread).toBe(30);
    expect(processOrderbook(raw, 12, 1, QUOTE_DECIMALS).spread).toBe(30);
    expect(processOrderbook(raw, 12, 10, QUOTE_DECIMALS).spread).toBe(30);
  });

  it('scales the depth bars off the largest visible row', () => {
    const processed = processOrderbook(
      book({ bids: [level(9980, 1), level(9870, 3)] }),
      12,
      1,
      QUOTE_DECIMALS
    );

    expect(processed.buys[0]?.depth).toBeCloseTo(33.33, 2);
    expect(processed.buys[1]?.depth).toBe(100);
  });
});
