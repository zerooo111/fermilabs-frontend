/**
 * Drawing color presets and hex normalising, shared by the drawing toolbar
 * and settings tabs. CandleFrame validates drawing colors as hex.
 */
/** The chart's ink first (accent, cream, emerald, crimson), then a spectrum. */
export const DRAWING_COLORS = [
  '#fde68a',
  '#f8f7e7',
  '#35cc86',
  '#ff645f',
  '#a9aa9c',
  '#4a5f53',
  '#fb923c',
  '#facc15',
  '#2dd4bf',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
];

/** Expands #rgb / #rrggbbaa to #rrggbb, which `<input type="color">` needs. */
export function toHex6(color: string): string {
  const hex = color.replace('#', '');
  if (hex.length === 3 || hex.length === 4) {
    return `#${[...hex.slice(0, 3)].map(c => c + c).join('')}`.toLowerCase();
  }
  return `#${hex.slice(0, 6)}`.toLowerCase();
}
