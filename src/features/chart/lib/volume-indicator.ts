/**
 * Volume as an indicator in its own pane, as on TradingView, instead of
 * CandleFrame's volume layer under the price candles. Bars take the candle
 * colors: one column output for up bars and one for down bars, each NaN on
 * the other's bars.
 */
import type { IndicatorDefinition } from 'candleframe/core';

type RGBA = readonly [number, number, number, number];

const OPACITY = 0.5;
/** The tallest visible bar fills about 1 / HEADROOM of the pane. */
const HEADROOM = 1.4;

function rgba(hex: string): RGBA {
  const n = parseInt(hex.slice(1, 7), 16);
  if (!Number.isFinite(n)) return [0.6, 0.64, 0.7, OPACITY];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, OPACITY];
}

export const VOLUME_KIND = 'volume';

/**
 * `colors` is read on every draw (the renderer reads each output's `color`),
 * so bars follow candle color changes in chart settings without a reload.
 */
export function volumeIndicator(colors: () => { up: string; down: string }): IndicatorDefinition {
  return {
    kind: VOLUME_KIND,
    name: 'Volume',
    description: 'Traded volume per bar, in the base asset',
    pane: 'separate',
    inputs: {},
    create: (_inputs, id) => ({
      id,
      name: 'Volume',
      kind: VOLUME_KIND,
      inputs: {},
      pane: 'separate',
      color: rgba(colors().up),
      outputs: [
        {
          id: 'up',
          name: 'Volume',
          style: 'column',
          get color() {
            return rgba(colors().up);
          },
        },
        {
          id: 'down',
          name: 'Volume',
          style: 'column',
          get color() {
            return rgba(colors().down);
          },
        },
        // Panes fit the visible values, which would put the smallest bar at
        // the bottom with no height. This undrawn zero pins the floor at 0.
        // NaN on the last bar keeps it out of the pane title's latest values.
        { id: 'floor', name: '', style: 'none', color: [0, 0, 0, 0] },
        // Headroom: an undrawn value above each bar, so the tallest visible
        // bar stops short of the pane title instead of running into it.
        { id: 'headroom', name: '', style: 'none', color: [0, 0, 0, 0] },
      ],
      calculateOutputs: candles => {
        const last = candles.length - 1;
        return [
          candles.map(c => (c.close >= c.open ? c.volume : Number.NaN)),
          candles.map(c => (c.close < c.open ? c.volume : Number.NaN)),
          candles.map((_, i) => (i === last ? Number.NaN : 0)),
          candles.map((c, i) => (i === last ? Number.NaN : c.volume * HEADROOM)),
        ];
      },
    }),
  };
}
