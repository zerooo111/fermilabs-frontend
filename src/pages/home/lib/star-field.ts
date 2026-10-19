// Quiet night sky behind the hero: sparse pixel stars, one canvas cell per
// 3 CSS pixels, each twinkling slowly at its own rate. Mostly dim; only a
// few ever reach the brightest tone. Same tones as the UFO scene's stars.

import { createClock, packColor, type RGB } from './dither';

const CELL = 3; // CSS pixels per cell
const DENSITY = 1 / 1800; // stars per cell
const TONES: (RGB | null)[] = [null, [14, 40, 28], [40, 66, 52], [96, 110, 96], [180, 182, 168]];
const TONES_PX = TONES.map(packColor);

type Star = { x: number; y: number; phase: number; rate: number; peak: number };

export function initStarField(
  canvas: HTMLCanvasElement,
  { reducedMotion = false } = {}
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let w = 0;
  let h = 0;
  let image: ImageData;
  let px: Uint32Array;
  let stars: Star[] = [];
  let t = 0;

  function layout() {
    w = Math.max(1, Math.ceil(canvas.clientWidth / CELL));
    h = Math.max(1, Math.ceil(canvas.clientHeight / CELL));
    canvas.width = w;
    canvas.height = h;
    image = ctx!.createImageData(w, h);
    px = new Uint32Array(image.data.buffer);
    stars = Array.from({ length: Math.round(w * h * DENSITY) }, () => ({
      x: Math.floor(Math.random() * w),
      y: Math.floor(Math.random() * h),
      phase: Math.random() * Math.PI * 2,
      rate: 0.004 + Math.random() * 0.012,
      // Most stars stay faint; about one in eight can reach the top tone
      peak: Math.random() < 0.12 ? 4 : 2 + Math.floor(Math.random() * 2),
    }));
  }

  function render() {
    px.fill(0);
    for (const s of stars) {
      const v = 0.5 + 0.5 * Math.sin(s.phase + t * s.rate);
      const level = Math.round(v * s.peak);
      if (level > 0) px[s.y * w + s.x] = TONES_PX[level];
    }
    ctx!.putImageData(image, 0, 0);
  }

  layout();
  const resize = new ResizeObserver(() => {
    layout();
    render();
  });
  resize.observe(canvas);

  if (reducedMotion) {
    render();
    return () => resize.disconnect();
  }

  let frameId = 0;
  let running = false;
  const clock = createClock();

  function loop(now: number) {
    const steps = clock.steps(now);
    if (steps) {
      t += steps;
      render();
    }
    frameId = requestAnimationFrame(loop);
  }

  // Only twinkle while on screen
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) {
      running = true;
      clock.reset();
      frameId = requestAnimationFrame(loop);
    } else if (!entry.isIntersecting) {
      cancelAnimationFrame(frameId);
      running = false;
    }
  });
  observer.observe(canvas);
  render();

  return () => {
    cancelAnimationFrame(frameId);
    observer.disconnect();
    resize.disconnect();
  };
}
