// Dithered Fermi Trade mark in the hero background. The mark is a 7x4 pixel
// glyph; every glyph pixel becomes a block of cells lit by a soft light from
// the top right and ordered-dithered into forest, lichen and amber tones.
// Every lit cell is a particle that the pointer pushes away and a spring
// pulls back home.

import { createClock, ditherLevel, packColor, type RGB } from './dither';

// Same glyph as public/logo.svg, row by row
const GLYPH = ['...#...', '..###..', '.##..#.', '##.####'];

// Darkest first; level 0 is left empty so the page shows through
const BODY: (RGB | null)[] = [
  null,
  [32, 104, 72],
  [46, 138, 104],
  [104, 184, 132],
  [180, 220, 120],
];
// The peak of the mark catches the light
const CAP: (RGB | null)[] = [null, [96, 112, 58], [196, 170, 84], [254, 230, 133], [248, 247, 231]];
const BODY_PX = BODY.map(packColor);
const CAP_PX = CAP.map(packColor);

const BLOCK = 18; // cells per glyph pixel
const GAP = 2; // cells of gutter inside each block, so the pixels read as tiles
const PAD = 16; // empty cells around the mark so pushed cells have room
const GW = GLYPH[0].length * BLOCK + PAD * 2;
const GH = GLYPH.length * BLOCK + PAD * 2;
const RADIUS = 18; // cells, pointer influence
const PUSH = 1.4;
const SPRING = 0.05;
const DAMPING = 0.16;
const SCATTER = 26; // cells, how far cells start from home on load

type Particle = { hx: number; hy: number; x: number; y: number; vx: number; vy: number; c: number };

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function buildParticles(): Particle[] {
  const particles: Particle[] = [];
  const w = GLYPH[0].length * BLOCK;
  const h = GLYPH.length * BLOCK;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = Math.floor(x / BLOCK);
      const gy = Math.floor(y / BLOCK);
      if (GLYPH[gy][gx] !== '#') continue;
      const lx = x % BLOCK;
      const ly = y % BLOCK;
      if (lx >= BLOCK - GAP || ly >= BLOCK - GAP) continue;

      const cap = gy === 0;
      // Light falls from the top right; each tile also has its own bevel
      const fx = x / w;
      const fy = y / h;
      let v = smoothstep(1.25, 0.15, Math.hypot(fx - 0.9, fy - 0.05));
      v *= 0.72 + 0.28 * (1 - ly / BLOCK) * (0.6 + 0.4 * (lx / BLOCK));
      if (cap) v = 0.35 + v * 0.65;

      const tones = cap ? CAP_PX : BODY_PX;
      const tone = tones[ditherLevel(v, tones.length - 1, x, y)];
      if (!tone) continue;
      particles.push({ hx: x + PAD, hy: y + PAD, x: x + PAD, y: y + PAD, vx: 0, vy: 0, c: tone });
    }
  }
  return particles;
}

export function initLogoField(
  canvas: HTMLCanvasElement,
  { reducedMotion = false } = {}
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const particles = buildParticles();
  canvas.width = GW;
  canvas.height = GH;
  const image = ctx.createImageData(GW, GH);
  const px = new Uint32Array(image.data.buffer);

  function render() {
    px.fill(0);
    for (const p of particles) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
      px[y * GW + x] = p.c;
    }
    ctx!.putImageData(image, 0, 0);
  }

  if (reducedMotion) {
    render();
    return () => {};
  }

  // Start scattered and let the springs assemble the mark
  for (const p of particles) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * SCATTER;
    p.x += Math.cos(a) * d;
    p.y += Math.sin(a) * d;
  }

  let pointer: { x: number; y: number } | null = null;
  let frameId = 0;
  let running = false;
  let visible = true;
  const clock = createClock();

  function step() {
    let energy = 0;
    for (const p of particles) {
      if (pointer) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < RADIUS && d > 0.001) {
          const f = (1 - d / RADIUS) ** 2 * PUSH;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
      }
      p.vx = (p.vx + (p.hx - p.x) * SPRING) * (1 - DAMPING);
      p.vy = (p.vy + (p.hy - p.y) * SPRING) * (1 - DAMPING);
      p.x += p.vx;
      p.y += p.vy;
      energy += Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y);
    }
    return energy;
  }

  function loop(now: number) {
    const steps = clock.steps(now);
    if (!steps) {
      frameId = requestAnimationFrame(loop);
      return;
    }
    let energy = 0;
    for (let i = 0; i < steps; i++) energy = step();
    render();
    // Sleep once everything is home and the pointer is away
    if (!pointer && energy < particles.length * 0.02) {
      for (const p of particles) {
        p.x = p.hx;
        p.y = p.hy;
        p.vx = 0;
        p.vy = 0;
      }
      render();
      running = false;
      return;
    }
    frameId = requestAnimationFrame(loop);
  }

  function wake() {
    if (running || !visible) return;
    running = true;
    clock.reset();
    frameId = requestAnimationFrame(loop);
  }

  // The canvas sits behind the hero text, so listen on the whole section.
  // Layout is read in the handler, not in rAF, so it never forces a
  // synchronous layout after another animation's DOM writes.
  const area = canvas.closest('section') ?? canvas.parentElement!;
  function onPointerMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const cell = rect.width / GW;
    pointer = { x: (e.clientX - rect.left) / cell, y: (e.clientY - rect.top) / cell };
    wake();
  }
  function onPointerLeave() {
    pointer = null;
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
    else {
      cancelAnimationFrame(frameId);
      running = false;
    }
  });
  observer.observe(canvas);
  area.addEventListener('pointermove', onPointerMove);
  area.addEventListener('pointerleave', onPointerLeave);
  wake();

  return () => {
    cancelAnimationFrame(frameId);
    observer.disconnect();
    area.removeEventListener('pointermove', onPointerMove);
    area.removeEventListener('pointerleave', onPointerLeave);
  };
}
