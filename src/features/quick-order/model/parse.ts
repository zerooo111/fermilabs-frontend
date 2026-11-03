/**
 * Quick-order command parser.
 *
 * Grammar: a comma-separated list of `<side> <size> <symbol>` legs, e.g.
 * "long 2 SOL, short 0.5 BTC, l 1,000 JLP". Sides take short aliases
 * (l/s, buy/sell), sizes may be comma-grouped, and symbols resolve
 * case-insensitively against the markets the caller passes in.
 *
 * Pure on purpose: everything it needs arrives as arguments, so the whole
 * grammar is covered by unit tests (parse.test.ts).
 */
import type { OrderSide } from '@/features/order-placement/lib/PerpLimitOrderIntent';

/** How many orders one command may carry. */
export const MAX_BASKET_LEGS = 5;

/** The subset of a market the parser resolves symbols against. */
export interface QuickOrderMarket {
  /** Market index, as `Market.uuid` holds it. */
  id: string;
  /** Display symbol, e.g. "SOL-PERP". */
  symbol: string;
  /** Base asset, e.g. "SOL". */
  base: string;
}

export interface QuickOrderLeg {
  side: OrderSide;
  /** Base size in UI units. */
  size: number;
  market: QuickOrderMarket;
}

export type ParsedLeg =
  | { ok: true; raw: string; leg: QuickOrderLeg }
  | { ok: false; raw: string; error: string };

export interface QuickOrderParse {
  legs: ParsedLeg[];
  /** A problem with the command as a whole rather than with one leg. */
  error: string | null;
  /** True when there is at least one leg and every leg resolved. */
  valid: boolean;
}

const SIDE_WORDS: Record<string, OrderSide> = {
  l: 'Buy',
  long: 'Buy',
  b: 'Buy',
  buy: 'Buy',
  bid: 'Buy',
  s: 'Sell',
  short: 'Sell',
  sell: 'Sell',
  ask: 'Sell',
};

/** Spoken names for bases we list; tickers come from the market list itself. */
const SYMBOL_ALIASES: Record<string, string> = {
  SOLANA: 'SOL',
  BITCOIN: 'BTC',
  XBT: 'BTC',
  ETHEREUM: 'ETH',
  WETH: 'ETH',
  WBTC: 'BTC',
  JUPITER: 'JUP',
};

// A comma between digits in a group of three is a thousands separator
// ("1,000"), not the end of a leg.
const LEG_SEPARATOR = /,(?!\d{3}(?:\D|$))/;

const SIZE_AND_SYMBOL = /^([\d.,]+)\s*(.*)$/;

/** "SOL-PERP", "SOL/USDC", "SOL-USD" all key on the base. */
function symbolKeys(market: QuickOrderMarket): string[] {
  return [market.base, market.symbol, market.symbol.replace(/[-/](PERP|USDC?|USD)$/i, '')].map(s =>
    s.toUpperCase()
  );
}

function resolveMarket(
  text: string,
  markets: QuickOrderMarket[]
): { market: QuickOrderMarket } | { error: string } {
  const key = text.toUpperCase().replace(/\s+/g, '');
  const aliased = SYMBOL_ALIASES[key] ?? key;

  const exact = markets.find(m => symbolKeys(m).includes(aliased));
  if (exact) return { market: exact };

  // Prefix, then substring — only when a single market matches, so "B" never
  // silently picks BTC over BNB.
  for (const match of [
    (m: QuickOrderMarket) => symbolKeys(m).some(k => k.startsWith(aliased)),
    (m: QuickOrderMarket) => symbolKeys(m).some(k => k.includes(aliased)),
  ]) {
    const hits = markets.filter(match);
    if (hits.length === 1) return { market: hits[0] };
    if (hits.length > 1) {
      return { error: `"${text}" matches ${hits.map(m => m.base).join(', ')} — be specific` };
    }
  }

  // Nothing matched: point at the nearest base when the first letters agree.
  const near = markets.find(m => m.base.startsWith(aliased.slice(0, 2)));
  return {
    error: near
      ? `No market called "${text}" — did you mean ${near.base}?`
      : `No market called "${text}"`,
  };
}

function parseLeg(raw: string, markets: QuickOrderMarket[]): ParsedLeg {
  const fail = (error: string): ParsedLeg => ({ ok: false, raw, error });
  const words = raw.trim().split(/\s+/);

  const side = SIDE_WORDS[words[0].toLowerCase()];
  if (!side) {
    return fail(`Start with long or short — e.g. "long 2 ${markets[0]?.base ?? 'SOL'}"`);
  }

  const rest = words.slice(1).join(' ').trim();
  if (!rest) return fail('Add a size and a market, e.g. "long 2 SOL"');

  const parts = SIZE_AND_SYMBOL.exec(rest);
  if (!parts) return fail(`Expected a size after "${words[0]}", e.g. "long 2 SOL"`);

  const size = Number(parts[1].replace(/,/g, ''));
  if (!Number.isFinite(size) || size <= 0) return fail(`"${parts[1]}" is not a valid size`);

  const symbol = parts[2].trim();
  if (!symbol) return fail(`Add a market after the size, e.g. "long ${parts[1]} SOL"`);

  const resolved = resolveMarket(symbol, markets);
  if ('error' in resolved) return fail(resolved.error);

  return { ok: true, raw, leg: { side, size, market: resolved.market } };
}

/**
 * Parse a quick-order command. Every leg is reported, good or bad, so the
 * palette can show live feedback while the user is still typing.
 */
export function parseQuickOrder(input: string, markets: QuickOrderMarket[]): QuickOrderParse {
  const segments = input
    .split(LEG_SEPARATOR)
    .map(s => s.trim())
    // Trailing and doubled commas just mean "more to come".
    .filter(s => s.length > 0);

  if (segments.length === 0) return { legs: [], error: null, valid: false };

  const legs = segments.map(segment => parseLeg(segment, markets));
  const error =
    segments.length > MAX_BASKET_LEGS
      ? `Up to ${MAX_BASKET_LEGS} orders per command — you typed ${segments.length}`
      : null;

  return { legs, error, valid: !error && legs.every(l => l.ok) };
}

/** "Long 2 SOL" — the one-line form used in rows, toasts and buttons. */
export function describeLeg(leg: QuickOrderLeg): string {
  return `${leg.side === 'Buy' ? 'Long' : 'Short'} ${leg.size} ${leg.market.base}`;
}
