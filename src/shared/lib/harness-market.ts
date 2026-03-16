import { config } from '@/shared/config/constants';
import {
  baseLotsToUi,
  priceLotsToUi,
  quoteLotsToUi,
  uiToNativeScaled,
} from '@/shared/lib/mango-sdk-conversions';

export interface HarnessMarketConversionParams {
  base_mint?: string;
  quote_mint?: string;
  base_decimals?: number;
  quote_decimals?: number;
  base_lot_size?: number | string;
  quote_lot_size?: number | string;
}

export interface HarnessMarketMetadata extends HarnessMarketConversionParams {
  market_index: number;
  name: string;
  base_symbol: string;
  quote_symbol: string;
  perp_market: string;
  oracle: string;
  bids: string;
  asks: string;
  event_queue: string;
  open_interest: string;
}

function toFiniteNumber(value: number | string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveMarketConversionParams(
  market?: HarnessMarketConversionParams | null
): Required<HarnessMarketConversionParams> {
  return {
    base_mint: market?.base_mint || '',
    quote_mint: market?.quote_mint || '',
    base_decimals: toFiniteNumber(market?.base_decimals, config.devnet.baseDecimals),
    quote_decimals: toFiniteNumber(market?.quote_decimals, config.devnet.quoteDecimals),
    base_lot_size: toFiniteNumber(market?.base_lot_size, config.devnet.baseLotSize),
    quote_lot_size: toFiniteNumber(market?.quote_lot_size, config.devnet.quoteLotSize),
  };
}

export function lotsPriceToUiWithMarket(
  priceLots: string | number,
  market?: HarnessMarketConversionParams | null
): number {
  const params = resolveMarketConversionParams(market);
  return priceLotsToUi(priceLots, {
    baseDecimals: params.base_decimals,
    quoteDecimals: params.quote_decimals,
    baseLotSize: params.base_lot_size,
    quoteLotSize: params.quote_lot_size,
  });
}

export function lotsPriceToNative(
  priceLots: string | number,
  market?: HarnessMarketConversionParams | null
): number {
  const params = resolveMarketConversionParams(market);
  return uiToNativeScaled(lotsPriceToUiWithMarket(priceLots, params), params.quote_decimals);
}

export function lotsBaseToNative(
  baseLots: string | number,
  market?: HarnessMarketConversionParams | null
): number {
  const params = resolveMarketConversionParams(market);
  const uiBase = baseLotsToUi(baseLots, {
    baseDecimals: params.base_decimals,
    baseLotSize: params.base_lot_size,
  });
  return uiToNativeScaled(uiBase, params.base_decimals);
}

export function lotsQuoteToNative(
  quoteLots: string | number,
  market?: HarnessMarketConversionParams | null
): number {
  const params = resolveMarketConversionParams(market);
  const uiQuote = quoteLotsToUi(quoteLots, {
    quoteDecimals: params.quote_decimals,
    quoteLotSize: params.quote_lot_size,
  });
  return uiToNativeScaled(uiQuote, params.quote_decimals);
}

export function nativeToUiNumber(nativeAmount: string | number | bigint, decimals: number): number {
  const numeric = typeof nativeAmount === 'bigint' ? Number(nativeAmount) : Number(nativeAmount);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric / Math.pow(10, Math.max(0, decimals));
}
