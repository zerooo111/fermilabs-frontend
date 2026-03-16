type LotConversionParams = {
  baseDecimals: number;
  quoteDecimals: number;
  baseLotSize: number;
  quoteLotSize: number;
};

function toFiniteNumber(value: string | number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pow10(decimals: number): number {
  return Math.pow(10, Math.max(0, Math.floor(decimals)));
}

// Mirrors Mango v4 SDK converter logic:
// priceLotsToUiConverter = 10^(baseDecimals-quoteDecimals) * quoteLotSize / baseLotSize
export function priceLotsToUi(priceLots: string | number, params: LotConversionParams): number {
  const lots = toFiniteNumber(priceLots);
  if (lots <= 0) return 0;
  const baseLotSize = Math.max(1, toFiniteNumber(params.baseLotSize));
  const quoteLotSize = Math.max(1, toFiniteNumber(params.quoteLotSize));
  const converter =
    Math.pow(10, params.baseDecimals - params.quoteDecimals) * (quoteLotSize / baseLotSize);
  return lots * converter;
}

// Mirrors Mango v4 SDK converter logic:
// baseLotsToUiConverter = baseLotSize / 10^baseDecimals
export function baseLotsToUi(
  baseLots: string | number,
  params: Pick<LotConversionParams, 'baseDecimals' | 'baseLotSize'>
): number {
  const lots = toFiniteNumber(baseLots);
  if (lots <= 0) return 0;
  const baseLotSize = Math.max(1, toFiniteNumber(params.baseLotSize));
  return lots * (baseLotSize / pow10(params.baseDecimals));
}

// Mirrors Mango v4 SDK converter logic:
// quoteLotsToUiConverter = quoteLotSize / 10^quoteDecimals
export function quoteLotsToUi(
  quoteLots: string | number,
  params: Pick<LotConversionParams, 'quoteDecimals' | 'quoteLotSize'>
): number {
  const lots = toFiniteNumber(quoteLots);
  if (lots <= 0) return 0;
  const quoteLotSize = Math.max(1, toFiniteNumber(params.quoteLotSize));
  return lots * (quoteLotSize / pow10(params.quoteDecimals));
}

export function uiToNativeScaled(uiAmount: number, decimals: number): number {
  if (!Number.isFinite(uiAmount) || uiAmount <= 0) return 0;
  return Math.round(uiAmount * pow10(decimals));
}
