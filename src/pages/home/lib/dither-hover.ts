// Dithered mesh gradient for cards on hover: a few soft blobs drift across the
// card and blend into each other, breathing gently, with the first blob drawn
// toward the pointer. Rendered at low resolution behind the card's content
// and only animated while hovered.

import { BAYER, createClock, packColor, type RGB } from './dither';

// Transparent, then two tones only a shade above the card background
// (#185038) so the hover stays subtle behind text
const TONES = ([null, [31, 93, 65], [39, 106, 74]] as (RGB | null)[]).map(packColor);

const CELL = 3; // CSS pixels per dither cell

// Each blob wanders on its own slow Lissajous path (positions are 0..1 of the
// card); weights and radii vary so the mesh never looks symmetric
const BLOBS = [
  { fx: 0.011, fy: 0.008, phase: 0.0, radius: 0.24, weight: 1 },
  { fx: 0.007, fy: 0.012, phase: 2.1, radius: 0.2, weight: 0.85 },
  { fx: 0.013, fy: 0.006, phase: 4.2, radius: 0.16, weight: 0.8 },
  { fx: 0.005, fy: 0.01, phase: 5.3, radius: 0.26, weight: 0.7 },
];

function attach(card: HTMLElement) {
  // Created on first hover so cards that are never hovered cost nothing
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let w = 0;
  let h = 0;
  let image: ImageData;
  let pixels: Uint32Array;
  let gx: Float32Array[] = [];
  let gy: Float32Array[] = [];
  let frameId = 0;
  const clock = createClock();
  let time = 0;
  let amp = 0; // eased 0..1 intensity
  let hovered = false;
  let px = 0;
  let py = 0;
  // Where the pointer-led blob currently sits, eased toward the pointer
  let lead = { x: 0.5, y: 0.5 };

  function size(rect: DOMRect) {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'dither-hover-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      card.prepend(canvas);
      card.classList.add('has-dither-canvas');
      ctx = canvas.getContext('2d');
    }
    const nw = Math.max(1, Math.ceil(rect.width / CELL));
    const nh = Math.max(1, Math.ceil(rect.height / CELL));
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    canvas.width = w;
    canvas.height = h;
    image = ctx!.createImageData(w, h);
    pixels = new Uint32Array(image.data.buffer);
    gx = BLOBS.map(() => new Float32Array(w));
    gy = BLOBS.map(() => new Float32Array(h));
  }

  // Layout is read in input handlers, which run before rAF callbacks while
  // layout is still clean
  function track(e: PointerEvent) {
    const rect = card.getBoundingClientRect();
    size(rect);
    px = (e.clientX - rect.left) / CELL;
    py = (e.clientY - rect.top) / CELL;
  }

  function step() {
    time += 1;
    amp += ((hovered ? 1 : 0) - amp) * 0.12;
    lead.x += (px / w - lead.x) * 0.04;
    lead.y += (py / h - lead.y) * 0.04;
  }

  function render() {
    const levels = TONES.length - 1;
    const breathe = 0.78 + 0.22 * Math.sin(time * 0.045);
    const span = Math.max(w, h);

    // A gaussian splits into an x part times a y part, so each blob's falloff
    // is computed per column and row instead of per cell. Weights are folded
    // into the x part.
    BLOBS.forEach((b, i) => {
      const bx = (i === 0 ? lead.x : 0.5 + 0.4 * Math.sin(time * b.fx + b.phase)) * w;
      const by = (i === 0 ? lead.y : 0.5 + 0.4 * Math.cos(time * b.fy + b.phase * 1.3)) * h;
      const inv = 1 / (b.radius * span) ** 2;
      for (let x = 0; x < w; x++) gx[i][x] = b.weight * Math.exp(-((x - bx) ** 2) * inv);
      for (let y = 0; y < h; y++) gy[i][y] = Math.exp(-((y - by) ** 2) * inv);
    });

    const scale = amp * breathe;
    const [gx0, gx1, gx2, gx3] = gx;
    const [gy0, gy1, gy2, gy3] = gy;
    for (let y = 0; y < h; y++) {
      const y0 = gy0[y];
      const y1 = gy1[y];
      const y2 = gy2[y];
      const y3 = gy3[y];
      const bayerRow = (y & 7) * 8;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const mesh = gx0[x] * y0 + gx1[x] * y1 + gx2[x] * y2 + gx3[x] * y3;
        // A light base so the whole card glows between the blobs
        const v = Math.min(1, scale * (0.1 + mesh * 0.7)) * levels;
        const base = Math.floor(v);
        const tone = Math.min(levels, base + (v - base > BAYER[bayerRow + (x & 7)] ? 1 : 0));
        pixels[row + x] = TONES[tone];
      }
    }
    ctx!.putImageData(image, 0, 0);
  }

  function loop(now: number) {
    const steps = clock.steps(now);
    if (!steps) {
      frameId = requestAnimationFrame(loop);
      return;
    }
    for (let i = 0; i < steps; i++) step();
    render();
    if (!hovered && amp < 0.01) {
      amp = 0;
      ctx!.clearRect(0, 0, w, h);
      frameId = 0;
      return;
    }
    frameId = requestAnimationFrame(loop);
  }

  function onEnter(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    track(e);
    hovered = true;
    if (frameId) return;
    // Start the lead blob under the pointer rather than easing in from centre
    lead = { x: px / w, y: py / h };
    clock.reset();
    frameId = requestAnimationFrame(loop);
  }
  function onLeave() {
    hovered = false;
  }

  card.addEventListener('pointerenter', onEnter);
  card.addEventListener('pointermove', track);
  card.addEventListener('pointerleave', onLeave);

  return () => {
    cancelAnimationFrame(frameId);
    card.removeEventListener('pointerenter', onEnter);
    card.removeEventListener('pointermove', track);
    card.removeEventListener('pointerleave', onLeave);
    canvas?.remove();
    card.classList.remove('has-dither-canvas');
  };
}

export function initDitherHover(root: ParentNode, selector: string): () => void {
  const detach = Array.from(root.querySelectorAll<HTMLElement>(selector)).map(attach);
  return () => detach.forEach(fn => fn());
}
