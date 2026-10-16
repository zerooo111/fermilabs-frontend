// A dithered depth-chart ridge, the boot splash's motif drawn live: bids climb
// to the left of the spread, asks to the right, and the ridge top dissolves
// upward through an 8x8 Bayer dither. One canvas pixel is one 3px CSS cell,
// upscaled nearest-neighbour. The canvas is drawn once per resize; any motion
// (the reveal, the amber order fills) is CSS in dither-ridge.css, so it stops
// under prefers-reduced-motion with a media query.
//
// Colour comes from the element's `color`, so tint it with a palette text
// class (`text-lichen`) and keep it faint with an opacity class.

import { useEffect, useRef, useState } from 'react';
import { BAYER } from '@/shared/lib/dither';
import { cn } from '@/lib/utils';
import './dither-ridge.css';

const CELL = 3; // CSS pixels per canvas pixel

// Small seeded PRNG so a ridge keeps its shape across resizes and renders
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Cumulative depth per column, 0..1: a staircase stepping up at random price
// levels, walking outward from an empty spread at the centre.
function depthProfile(cols: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const out = new Array<number>(cols).fill(0);
  const mid = cols / 2;
  const spread = Math.max(2, Math.round(cols * 0.025));
  for (const dir of [-1, 1]) {
    const start = Math.round(mid + dir * spread);
    const steps: number[] = [];
    let depth = 0;
    let next = 0;
    for (let i = 0; ; i++) {
      const c = start + dir * i;
      if (c < 0 || c >= cols) break;
      if (i >= next) {
        depth += 0.3 + rand();
        next = i + 2 + Math.floor(rand() * 6);
      }
      steps.push(depth);
    }
    // Each side tops out a little differently, like a real book
    const top = 0.82 + rand() * 0.18;
    // Eased so the ridge stays low near the spread and climbs at the edges
    steps.forEach((d, i) => (out[start + dir * i] = (d / depth) ** 1.5 * top));
  }
  return out;
}

export type DitherRidgeProps = {
  className?: string;
  /** Shape seed; the same seed always draws the same ridge. */
  seed?: number | string;
  /** Dither density inside the ridge, 0..1. */
  density?: number;
  /** Cells over which the ridge top dissolves. */
  fringe?: number;
  /** Amber "order fill" pixels flashing on the ridge top. */
  fills?: number;
  /** Build the ridge outward from the spread on mount. */
  reveal?: boolean;
};

type Fill = { left: number; bottom: number; delay: number };

export function DitherRidge({
  className,
  seed = 1,
  density = 0.5,
  fringe = 5,
  fills = 0,
  reveal = false,
}: DitherRidgeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fillDots, setFillDots] = useState<Fill[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!wrap || !canvas || !ctx) return;

    let lastCols = 0;
    let lastRows = 0;
    const draw = () => {
      const cols = Math.ceil(wrap.clientWidth / CELL);
      const rows = Math.ceil(wrap.clientHeight / CELL);
      if (!cols || !rows || (cols === lastCols && rows === lastRows)) return;
      lastCols = cols;
      lastRows = rows;

      canvas.width = cols;
      canvas.height = rows;
      canvas.style.width = `${cols * CELL}px`;
      canvas.style.height = `${rows * CELL}px`;
      ctx.clearRect(0, 0, cols, rows);
      ctx.fillStyle = getComputedStyle(canvas).color;

      const peak = Math.max(1, rows - fringe);
      const n = typeof seed === 'string' ? hashSeed(seed) : seed;
      const profile = depthProfile(cols, n);
      const tops = profile.map(v => Math.round(v * peak));
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          // d > 0 inside the ridge, <= 0 in the fringe above it
          const d = tops[x] - (rows - y);
          const v = d >= 0 ? density : density * (1 + d / fringe);
          if (v > BAYER[(y & 7) * 8 + (x & 7)]) ctx.fillRect(x, y, 1, 1);
        }
      }

      if (fills > 0) {
        const rand = mulberry32(n ^ 0x9e3779b9);
        const dots: Fill[] = [];
        for (let i = 0; i < fills * 4 && dots.length < fills; i++) {
          const x = Math.floor(rand() * cols);
          if (tops[x] < 3) continue;
          dots.push({ left: x * CELL, bottom: (tops[x] - 1) * CELL, delay: dots.length * 0.37 });
        }
        setFillDots(dots);
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [seed, density, fringe, fills]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn('dither-ridge', reveal && 'dither-ridge--reveal', className)}
    >
      <canvas ref={canvasRef} className="dither-ridge__canvas" />
      {fillDots.map(f => (
        <i
          key={`${f.left}-${f.bottom}`}
          className="dither-ridge__fill"
          style={{ left: f.left, bottom: f.bottom, animationDelay: `${f.delay}s` }}
        />
      ))}
    </div>
  );
}
