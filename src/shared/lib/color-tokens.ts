/**
 * Read color tokens from CSS for code that needs real color strings, such as
 * chart libraries and canvas. Tokens are defined in src/index.css under
 * `@theme static`, which emits every variable on :root.
 */

/** Resolved value of `--color-<name>`, e.g. readColorToken('positive-solid'). */
export function readColorToken(name: string, fallback = '#000000'): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${name}`)
    .trim();
  return value || fallback;
}

/**
 * Apply an alpha to a token value. Works for #rgb, #rrggbb and rgb() strings,
 * and falls back to color-mix for anything else (oklch, named colors).
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

/** The token set charts need, resolved once. Call inside an effect or memo after mount. */
export function readChartColors() {
  return {
    text: readColorToken('fg-tertiary', '#91a094'),
    textStrong: readColorToken('fg-secondary', '#b5beb0'),
    // Grid sits one step above the canvas so it reads as texture, not as lines.
    grid: readColorToken('surface-raised', '#112a22'),
    border: readColorToken('line', '#334940'),
    crosshair: readColorToken('line-strong', '#586d63'),
    labelBackground: readColorToken('surface-overlay', '#1b332b'),
    background: readColorToken('surface-base', '#08211a'),
    neutral: readColorToken('fg-primary', '#f8f7e7'),
    up: readColorToken('positive-solid', '#10b981'),
    down: readColorToken('negative-solid', '#ef4444'),
  };
}

export type ChartColors = ReturnType<typeof readChartColors>;
