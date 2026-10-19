/**
 * CandleFrame theme in the terminal palette (src/index.css): the forest
 * background, cream text, amber accent and the chart's emerald / crimson ink.
 * Hex only: CandleFrame themes take six-digit colors.
 */
import { createTheme } from 'candleframe/chart';

export const fermiChartTheme = createTheme('evergreen', {
  id: 'fermi',
  name: 'Fermi',
  palette: {
    background: '#001409', // --color-background
    surface: '#072618', // --color-surface
    raised: '#113021',
    border: '#1b3427',
    borderStrong: '#4a5f53',
    text: '#d9d8c8',
    textStrong: '#f8f7e7', // --color-rock
    textMuted: '#a9aa9c',
    textFaint: '#8a8c80',
    accent: '#fde68a', // --color-primary (amber-200)
    accentText: '#185038', // --color-primary-foreground
    positive: '#35cc86', // --color-success
    negative: '#ff645f', // --color-danger
    grid: '#071c12',
    drawing: '#fde68a',
    watermark: '#12301f',
  },
  typography: {
    uiFamily: "'Archivo', sans-serif",
    headingFamily: "'Archivo', sans-serif",
    numberFamily: "'Paper Mono', ui-monospace, monospace",
    annotationFamily: "'Paper Mono', ui-monospace, monospace",
  },
  chart: {
    watermarkOpacity: 0,
    // --color-buy-chart / --color-sell-chart: bolder than the UI success/danger.
    candleUp: '#219e61',
    candleDown: '#d53736',
    wickUp: '#219e61',
    wickDown: '#d53736',
    volumeUp: '#219e61',
    volumeDown: '#d53736',
    // Volume is an indicator in its own pane (volume-indicator.ts); the layer
    // is always off, so don't reserve its strip under the price plot.
    volumeHeight: 0,
    // Breathing room above each indicator pane, so axis labels and the pane
    // title don't crowd the divider. ChartPaneOverlays draws the one divider.
    volumeGap: 6,
    // The drawing rail already separates the plot from the edge.
    plotLeft: 4,
  },
});
