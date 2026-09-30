// Shared helpers for the landing page's dithered canvas animations.

export type RGB = [number, number, number];

// 8x8 Bayer matrix, normalised to thresholds in (0, 1)
export const BAYER = [
  0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52, 11, 59, 7, 55, 40, 24,
  36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61, 34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6,
  54, 9, 57, 5, 53, 42, 26, 38, 22, 41, 25, 37, 21,
].map(v => (v + 0.5) / 64);

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

// Pack a colour into one 32-bit pixel for a Uint32Array view of ImageData, so
// each pixel is one write instead of four. null is transparent.
export function packColor(c: RGB | null): number {
  if (!c) return 0;
  const [r, g, b] = c;
  return LITTLE_ENDIAN
    ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

// Quantise v (0..1) to one of `levels` steps using the Bayer threshold at x, y
export function ditherLevel(v: number, levels: number, x: number, y: number): number {
  const t = Math.min(1, Math.max(0, v)) * levels;
  const lo = Math.floor(t);
  return Math.min(levels, lo + (t - lo > BAYER[(y & 7) * 8 + (x & 7)] ? 1 : 0));
}

const STEP_MS = 1000 / 60;

// Simulations are tuned per step at 60 steps a second. This turns rAF
// timestamps into a step count so they run at the same speed on 60Hz and
// 120Hz displays, and skip drawing on frames where nothing stepped.
export function createClock() {
  let last = 0;
  let acc = 0;
  return {
    // Call when (re)starting the loop so paused time isn't caught up
    reset() {
      last = 0;
      acc = 0;
    },
    steps(now: number) {
      // Clamp long gaps (tab switch, jank) instead of fast-forwarding
      acc += last ? Math.min(now - last, 100) : STEP_MS;
      last = now;
      // 1ms of slack so frame-time jitter at 60Hz doesn't alternate between
      // zero and two steps
      const n = Math.floor((acc + 1) / STEP_MS);
      acc -= n * STEP_MS;
      return n;
    },
  };
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
