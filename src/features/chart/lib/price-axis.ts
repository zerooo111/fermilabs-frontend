/**
 * Price axis width fitted to the market's labels. CandleFrame's axis is a
 * fixed width (78px by default), which wastes space on a 6-character price
 * like 105.756.
 */
import { fermiChartTheme } from './candleframe-theme';

const { chart, typography } = fermiChartTheme;
const MIN_WIDTH = 40;
const MAX_WIDTH = 180;

let measureCtx: CanvasRenderingContext2D | null | undefined;

function textWidth(text: string): number {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return text.length * typography.axisSize * 0.62;
  measureCtx.font = `${typography.axisSize}px ${typography.numberFamily}`;
  return measureCtx.measureText(text).width;
}

/** Whole digits in labels for `price`, with room for a 1.5x rally. */
export function priceDigits(price: number | null): number | null {
  if (price === null || !Number.isFinite(price) || price <= 0) return null;
  return String(Math.floor(price * 1.5)).length;
}

/**
 * Width for the widest label with `digits` whole digits at `precision`,
 * formatted like CandleFrame's axis (en-US grouping). The label sits
 * `axisLabelPadding` in, with the same again on the right.
 */
export function priceAxisWidth(digits: number, precision: number): number {
  const label = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(Number('8'.repeat(digits) + (precision ? '.' + '8'.repeat(precision) : '')));
  const width = Math.ceil(textWidth(label) + chart.axisLabelPadding * 2);
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}
