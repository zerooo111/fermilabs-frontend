/**
 * Reads token values from the live stylesheet and computes WCAG contrast.
 * A 1x1 canvas does the parsing, so any CSS color string works.
 */
import { useEffect, useState } from 'react';

type Rgba = [number, number, number, number];

let ctx: CanvasRenderingContext2D | null = null;

function parse(color: string): Rgba {
  if (!ctx) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!ctx) return [0, 0, 0, 1];
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** Composites a possibly translucent color over an opaque background. */
function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3];
  return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)).concat(1) as Rgba;
}

function luminance([r, g, b]: Rgba) {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(fg: string, bg: string): number {
  const back = parse(bg);
  const front = over(parse(fg), back);
  const [hi, lo] = [luminance(front), luminance(back)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

export function toHex(color: string): string {
  const [r, g, b, a] = parse(color);
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  return a < 1 ? `${hex} @ ${Math.round(a * 100)}%` : hex;
}

export function tokenVar(name: string) {
  return `var(--color-${name})`;
}

/** Resolved values for the given token names, read once after mount. */
export function useTokens(names: string[]): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  const key = names.join(',');

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const name of key.split(',')) {
      next[name] = style.getPropertyValue(`--color-${name}`).trim();
    }
    setValues(next);
  }, [key]);

  return values;
}

export type Grade = 'AAA' | 'AA' | 'AA large' | 'Fail';

export function grade(ratio: number): Grade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'Fail';
}
