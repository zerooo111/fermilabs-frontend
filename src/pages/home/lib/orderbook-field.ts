// Dithered order book field. Orders drift in from both edges and join the
// back of a queue at their price level; the front of the best bid and best ask
// meet at the mid, fill, and the fill drops onto a settlement rail and leaves.
// The background is a cumulative depth chart rendered at low resolution with
// an 8x8 Bayer ordered dither that follows the live queues; the orders are
// crisp SVG squares on top.

import { createClock, ditherLevel, packColor, type RGB } from './dither';

type Side = 'bid' | 'ask';
type State = 'free' | 'queued' | 'taking' | 'fill';

type Order = {
  el: SVGRectElement;
  side: Side;
  level: number;
  state: State;
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Free flight: start point, progress and per-order easing
  x0: number;
  y0: number;
  t: number;
  dur: number;
  phase: number;
  angle: number;
  size: number;
  // Fill: frames since the match
  age: number;
};

// Tones, darkest first. Level 0 is left empty so the page shows through.
const BID: (RGB | null)[] = [null, [30, 94, 64], [48, 122, 78], [104, 168, 96], [180, 220, 120]];
const ASK: (RGB | null)[] = [null, [36, 92, 60], [92, 118, 64], [168, 160, 92], [253, 230, 138]];
const BID_PX = BID.map(packColor);
const ASK_PX = ASK.map(packColor);

const CELL = 3; // CSS pixels per field cell
const ITEM = 10; // CSS pixels, size of a resting order
const STACK = 14; // CSS pixels between orders in a queue
const MATCH_EVERY = 26; // frames between matches
const ARRIVE_EVERY = 13; // frames between arrivals (one per side per match)
// Springs: stiffness and damping per frame. Under-damped so queues settle
// with a small bounce when the front order leaves.
const K = 0.22;
const C = 0.3;
const SVG_NS = 'http://www.w3.org/2000/svg';

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function initOrderbookField(
  canvas: HTMLCanvasElement,
  {
    svg,
    reducedMotion = false,
    lowPower = false,
  }: { svg: SVGSVGElement; reducedMotion?: boolean; lowPower?: boolean }
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  // Layout, in CSS pixels, recomputed on resize
  let W = 0;
  let H = 0;
  let mid = 0;
  let base = 0; // queues rest on this line
  let rail = 0; // settlement rail
  let gap = 0; // between price levels
  let levels = 6; // per side
  let target: number[] = []; // resting queue length each level refills toward

  // Canvas
  let w = 0;
  let h = 0;
  let image: ImageData;
  let pixels: Uint32Array;
  let colDepth: Float32Array; // depth height per column, in cells
  let colFade: Float32Array; // depth brightness per column

  const queues: Record<Side, Order[][]> = { bid: [], ask: [] };
  const shown: Record<Side, number[]> = { bid: [], ask: [] }; // eased queue lengths
  let fills: Order[] = [];
  let taking: Order[] = [];
  let flash = 0; // 0..1, glow at the mid after a fill
  let ring: SVGCircleElement | null = null;
  let pointer: { x: number; y: number } | null = null;
  let time = 0;
  let frameId = 0;
  let running = false;
  const clock = createClock();

  const levelX = (side: Side, i: number) =>
    side === 'bid' ? mid - gap * (i + 0.9) : mid + gap * (i + 0.9);
  const slotY = (k: number) => base - ITEM / 2 - 4 - k * STACK;

  function makeEl(side: Side) {
    const el = document.createElementNS(SVG_NS, 'rect');
    el.setAttribute('class', 'ob-order');
    el.setAttribute('data-side', side);
    svg.appendChild(el);
    return el;
  }

  function spawn(side: Side, level: number, settled: boolean): Order {
    const q = queues[side][level];
    const o: Order = {
      el: makeEl(side),
      side,
      level,
      state: settled ? 'queued' : 'free',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      x0: side === 'bid' ? rand(-24, -8) : W + rand(8, 24),
      y0: rand(H * 0.08, base - STACK * 4),
      t: 0,
      dur: rand(55, 95) * (0.6 + (0.4 * W) / 1280),
      phase: rand(0, Math.PI * 2),
      angle: rand(-60, 60),
      size: rand(9, 13),
      age: 0,
    };
    if (settled) {
      o.x = levelX(side, level);
      o.y = slotY(q.length);
      o.angle = 0;
      o.size = ITEM;
    } else {
      o.x = o.x0;
      o.y = o.y0;
    }
    o.el.setAttribute('data-state', o.state);
    q.push(o);
    return o;
  }

  // Pick the level whose queue is furthest below its resting length. Inner
  // levels win ties, since matching drains the book from the mid outward.
  function arrive(side: Side) {
    let best = 0;
    let bestNeed = -Infinity;
    for (let i = 0; i < levels; i++) {
      const need = target[i] - queues[side][i].length + (levels - i) * 0.35 + Math.random() * 1.5;
      if (need > bestNeed) {
        bestNeed = need;
        best = i;
      }
    }
    if (queues[side][best].length < target[best] + 2) spawn(side, best, false);
  }

  // Take the front order from the best non-empty level, if it has arrived
  function front(side: Side) {
    for (const q of queues[side]) {
      if (!q.length) continue;
      return q[0].state === 'queued' ? q : null;
    }
    return null;
  }

  function match() {
    if (taking.length) return;
    const bq = front('bid');
    const aq = front('ask');
    if (!bq || !aq) return;
    for (const q of [bq, aq]) {
      const o = q.shift()!;
      o.state = 'taking';
      o.el.setAttribute('data-state', 'taking');
      taking.push(o);
    }
  }

  function settle() {
    const [a, b] = taking;
    a.el.remove();
    b.el.remove();
    taking = [];
    const f: Order = { ...a, el: makeEl(a.side), state: 'fill', x: mid, y: base - ITEM / 2 - 4 };
    f.vx = 0;
    f.vy = 0;
    f.age = 0;
    f.el.setAttribute('data-state', 'fill');
    fills.push(f);
    flash = 1;
    if (ring) {
      ring.setAttribute('cx', String(mid));
      ring.setAttribute('cy', String(f.y));
      ring.style.animation = 'none';
      // Restart the ring's CSS animation
      void ring.getBoundingClientRect();
      ring.style.animation = '';
    }
  }

  function spring(o: Order, tx: number, ty: number) {
    o.vx = (o.vx + (tx - o.x) * K) * (1 - C);
    o.vy = (o.vy + (ty - o.y) * K) * (1 - C);
    o.x += o.vx;
    o.y += o.vy;
  }

  function step() {
    time++;
    if (time % ARRIVE_EVERY === 0) arrive(time % (ARRIVE_EVERY * 2) === 0 ? 'bid' : 'ask');
    if (time % MATCH_EVERY === 0) match();

    for (const side of ['bid', 'ask'] as Side[]) {
      queues[side].forEach((q, i) => {
        const x = levelX(side, i);
        q.forEach((o, k) => {
          if (o.state === 'free') {
            // Eased flight to the back of the queue with a wobble that dies out
            o.t = Math.min(1, o.t + 1 / o.dur);
            const e = easeInOut(o.t);
            const wob = Math.sin(o.t * 9 + o.phase) * 14 * (1 - o.t);
            o.x = o.x0 + (x - o.x0) * e;
            o.y = o.y0 + (slotY(k) - o.y0) * e + wob;
            o.angle *= 0.97;
            o.size += (ITEM - o.size) * 0.06;
            if (o.t >= 1) {
              o.state = 'queued';
              o.angle = 0;
              o.size = ITEM;
              o.el.setAttribute('data-state', 'queued');
            }
          } else {
            spring(o, x, slotY(k));
          }
        });
        shown[side][i] += (q.length - shown[side][i]) * 0.12;
      });
    }

    if (taking.length) {
      const y = base - ITEM / 2 - 4;
      spring(taking[0], mid - ITEM * 0.55, y);
      spring(taking[1], mid + ITEM * 0.55, y);
      if (taking.every(o => Math.abs(o.x - (mid + (o.side === 'bid' ? -1 : 1) * ITEM * 0.55)) < 1))
        settle();
    }

    for (const f of fills) {
      f.age++;
      if (f.age < 22) spring(f, mid, rail);
      else f.x += Math.min(4.5, (f.age - 22) * 0.2);
    }
    fills = fills.filter(f => {
      if (f.x < W + 20) return true;
      f.el.remove();
      return false;
    });

    flash *= 0.9;
  }

  function draw() {
    for (const side of ['bid', 'ask'] as Side[]) {
      for (const q of queues[side]) for (const o of q) place(o);
    }
    for (const o of taking) place(o);
    for (const o of fills) place(o);
  }

  function place(o: Order) {
    const s = o.size;
    o.el.setAttribute('x', (o.x - s / 2).toFixed(1));
    o.el.setAttribute('y', (o.y - s / 2).toFixed(1));
    o.el.setAttribute('width', s.toFixed(1));
    o.el.setAttribute('height', s.toFixed(1));
    o.el.setAttribute(
      'transform',
      o.angle ? `rotate(${o.angle.toFixed(1)} ${o.x.toFixed(1)} ${o.y.toFixed(1)})` : ''
    );
  }

  function render() {
    const bc = base / CELL;
    const mc = mid / CELL;
    // Cumulative depth: every level adds its eased queue length outward
    // from the mid, with soft steps between levels
    let total = 0;
    for (let i = 0; i < levels; i++) total += Math.max(target[i] + 2, 1);
    const unit = (bc * 0.78) / total;
    for (let x = 0; x < w; x++) {
      const side: Side = x < mc ? 'bid' : 'ask';
      const d = Math.abs(x - mc) * CELL; // CSS px from mid
      let cum = 0;
      for (let i = 0; i < levels; i++) {
        const edge = gap * (i + 0.9) - ITEM;
        cum += shown[side][i] * Math.min(1, Math.max(0, (d - edge) / 6));
      }
      colDepth[x] = cum * unit;
      // Past the outermost level the book is resting depth only, so it fades
      colFade[x] = Math.exp(-Math.max(0, d - gap * (levels + 0.4)) / 160);
    }

    const breathe = 0.5 + 0.5 * Math.sin(time * 0.04);
    const px = pointer ? pointer.x / CELL : -1e3;
    const py = pointer ? pointer.y / CELL : -1e3;
    const pr = 1 / 26 ** 2;
    const fl = flash;

    for (let y = 0; y < h; y++) {
      const row = y * w;
      const dyp = (y - py) ** 2;
      for (let x = 0; x < w; x++) {
        const depth = colDepth[x];
        const up = bc - y; // cells above the baseline
        let v = 0;
        if (up > 0 && up <= depth) {
          const f = up / depth;
          v = (0.18 + 0.42 * f ** 1.6 + (depth - up < 1.2 ? 0.35 : 0)) * colFade[x];
        } else if (up > 0) {
          // Faint haze above the depth, strongest near it
          v = 0.16 * Math.exp(-(up - depth) / 10) * (0.8 + 0.2 * breathe);
        }
        const light = Math.exp(-((x - px) ** 2 + dyp) * pr);
        v += light * 0.3;
        // The mid lights up for a moment after every fill
        v += fl * 0.55 * Math.exp(-((x - mc) ** 2) / 18) * (y < bc + 2 ? 1 : 0.4);
        const tones = x < mc ? BID_PX : ASK_PX;
        pixels[row + x] = tones[ditherLevel(v, tones.length - 1, x, y)];
      }
    }
    ctx!.putImageData(image, 0, 0);
  }

  function reset() {
    for (const el of Array.from(svg.querySelectorAll('.ob-order'))) el.remove();
    fills = [];
    taking = [];
    for (const side of ['bid', 'ask'] as Side[]) {
      queues[side] = Array.from({ length: levels }, () => []);
      shown[side] = Array.from({ length: levels }, () => 0);
      for (let i = 0; i < levels; i++) {
        const n = Math.max(1, target[i] - (Math.random() < 0.5 ? 1 : 0));
        for (let k = 0; k < n; k++) spawn(side, i, true);
        shown[side][i] = n;
      }
    }
  }

  function drawStatic() {
    const text = (x: number, y: number, s: string, anchor = 'middle', cls = 'ob-label') => {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(x));
      t.setAttribute('y', String(y));
      t.setAttribute('text-anchor', anchor);
      t.setAttribute('class', cls);
      t.textContent = s;
      return t;
    };
    const line = (x1: number, y1: number, x2: number, y2: number, cls: string) => {
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('x1', String(x1));
      l.setAttribute('y1', String(y1));
      l.setAttribute('x2', String(x2));
      l.setAttribute('y2', String(y2));
      l.setAttribute('class', cls);
      return l;
    };
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'ob-static');
    g.append(
      line(0, base, W, base, 'ob-rule'),
      line(mid, base - 6, mid, base + 6, 'ob-tick'),
      line(0, rail, W, rail, 'ob-rail'),
      text(mid, base + 20, 'mid'),
      text(levelX('bid', levels - 1), base + 20, 'bids'),
      text(levelX('ask', levels - 1), base + 20, 'asks')
    );
    for (let i = 0; i < levels; i++) {
      for (const side of ['bid', 'ask'] as Side[]) {
        const x = levelX(side, i);
        g.append(line(x, base - 3, x, base + 3, 'ob-tick ob-tick--soft'));
      }
    }
    ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('r', '6');
    ring.setAttribute('class', 'ob-ring');
    ring.setAttribute('cx', '-100');
    ring.setAttribute('cy', '-100');
    g.append(ring);
    svg.querySelector('.ob-static')?.remove();
    svg.prepend(g);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    W = rect.width;
    H = rect.height;
    mid = Math.round(W / 2);
    base = Math.round(H * 0.64);
    rail = Math.round(H * 0.82);
    gap = Math.min(46, Math.max(22, W / 2 / 8.5));
    levels = Math.max(3, Math.min(6, Math.floor((W / 2 - 24) / gap) - 2));
    // Queues deepen away from the mid, like a real book, capped by the room
    // above the baseline
    const room = Math.floor((base - H * 0.12) / STACK);
    target = Array.from({ length: levels }, (_, i) => Math.min(room - 2, 2 + i));

    w = Math.max(1, Math.ceil(W / CELL));
    h = Math.max(1, Math.ceil(H / CELL));
    canvas.width = w;
    canvas.height = h;
    image = ctx!.createImageData(w, h);
    pixels = new Uint32Array(image.data.buffer);
    colDepth = new Float32Array(w);
    colFade = new Float32Array(w);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    drawStatic();
    reset();
    draw();
    render();
  }

  // Phones draw every other step: the simulation keeps full speed, only the
  // drawing (and its SVG writes) halves to 30fps
  const minSteps = lowPower ? 2 : 1;
  let pending = 0;

  function loop(now: number) {
    pending += clock.steps(now);
    if (pending >= minSteps) {
      for (let i = 0; i < pending; i++) step();
      pending = 0;
      draw();
      render();
    }
    frameId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    clock.reset();
    pending = 0;
    frameId = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(frameId);
    running = false;
  }

  resize();

  const ro = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width - W) > 1 || Math.abs(rect.height - H) > 1) resize();
  });
  ro.observe(canvas);

  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) start();
    else stop();
  });
  io.observe(canvas);

  // Layout is read in the handler rather than in rAF
  const area = canvas.parentElement!;
  function onPointerMove(e: PointerEvent) {
    // A finger on the field is a scroll, not a pointer to dodge
    if (e.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function onPointerLeave() {
    pointer = null;
  }
  if (!reducedMotion) {
    area.addEventListener('pointermove', onPointerMove);
    area.addEventListener('pointerleave', onPointerLeave);
  }

  return () => {
    stop();
    ro.disconnect();
    io.disconnect();
    area.removeEventListener('pointermove', onPointerMove);
    area.removeEventListener('pointerleave', onPointerLeave);
    svg.replaceChildren();
  };
}
