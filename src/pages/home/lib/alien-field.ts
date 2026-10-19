// Dithered UFO scene beside the hero headline. A pixel saucer bobs
// over the empty side of the section, its tractor beam sweeping the ground;
// space-invader aliens walk along a dotted ground line, and any that wanders
// under the beam is lifted into the saucer while a new one walks in. Same
// rendering as the order book field: one canvas cell per 3 CSS pixels,
// ordered-dithered into lichen and amber tones over the page background.

import { createClock, ditherLevel, packColor, type RGB } from './dither';

const W = 150; // cells
const H = 110;
const GROUND = 100; // ground line row

// Tones, darkest first. Level 0 is left empty so the page shows through; the
// low tones sit just above the page background (#001409).
const LICHEN: (RGB | null)[] = [null, [8, 40, 26], [20, 66, 44], [72, 138, 84], [180, 220, 120]];
const AMBER: (RGB | null)[] = [null, [16, 40, 22], [56, 72, 36], [140, 132, 72], [253, 230, 138]];
const STAR: (RGB | null)[] = [null, [24, 52, 38], [96, 110, 96], [210, 210, 196]];
const LICHEN_PX = LICHEN.map(packColor);
const AMBER_PX = AMBER.map(packColor);
const STAR_PX = STAR.map(packColor);
const ROCK = packColor([248, 247, 231]);
const GROUND_PX = packColor([44, 70, 56]);

// Saucer: A dome, L hull, o lights
const UFO = [
  '........AAAAAAA........',
  '......AAAAAAAAAAA......',
  '.....AAAAAAAAAAAAA.....',
  '..LLLLLLLLLLLLLLLLLLL..',
  'LLLLLLLLLLLLLLLLLLLLLLL',
  'LL.o..o..o..o..o..o..LL',
  'LLLLLLLLLLLLLLLLLLLLLLL',
  '...LLLLLLLLLLLLLLLLL...',
];
// Each sprite pixel is drawn as a SCALE x SCALE block of dithered cells, so the
// saucer holds its own beside the headline
const SCALE = 2;
const UFO_W = UFO[0].length * SCALE; // cells
const UFO_H = UFO.length * SCALE;

// Two species, two frames each
const CRAB = [
  [
    '..#.....#..',
    '...#...#...',
    '..#######..',
    '.##.###.##.',
    '###########',
    '#.#######.#',
    '#.#.....#.#',
    '...##.##...',
  ],
  [
    '..#.....#..',
    '#..#...#..#',
    '#.#######.#',
    '###.###.###',
    '###########',
    '.#########.',
    '..#.....#..',
    '.#.......#.',
  ],
];
const SQUID = [
  ['...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#'],
  ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'],
];

type Alien = {
  sprite: string[][];
  x: number; // left edge, cells
  y: number; // top edge, cells
  dir: 1 | -1;
  speed: number;
  amber: boolean;
  state: 'walk' | 'lift';
  lift: number; // 0..1 while lifted
};

type Star = { x: number; y: number; phase: number; rate: number };

const WALK_FRAMES = 22; // steps per sprite frame
const LIFT_STEPS = 150;
const RESPAWN_STEPS = 90;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function spriteHeight(a: Alien) {
  return a.sprite[0].length;
}

function spriteWidth(a: Alien) {
  return a.sprite[0][0].length;
}

function makeAlien(x: number, dir: 1 | -1): Alien {
  const crab = Math.random() < 0.5;
  const sprite = crab ? CRAB : SQUID;
  return {
    sprite,
    x,
    y: GROUND - sprite[0].length,
    dir,
    speed: 0.12 + Math.random() * 0.08,
    amber: Math.random() < 0.35,
    state: 'walk',
    lift: 0,
  };
}

export function initAlienField(
  canvas: HTMLCanvasElement,
  { reducedMotion = false } = {}
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  canvas.width = W;
  canvas.height = H;
  const image = ctx.createImageData(W, H);
  const px = new Uint32Array(image.data.buffer);

  const stars: Star[] = Array.from({ length: 22 }, () => ({
    x: Math.floor(Math.random() * W),
    y: Math.floor(Math.random() * (GROUND - 30)),
    phase: Math.random() * Math.PI * 2,
    rate: 0.01 + Math.random() * 0.03,
  }));
  const aliens: Alien[] = [makeAlien(18, 1), makeAlien(70, -1), makeAlien(118, -1)];

  let t = 0; // steps
  let ufoX = 92; // saucer centre, cells
  let targetX: number | null = null; // pointer, when hovering
  let flash = 0; // steps of light flash after an abduction
  let respawn = 0;

  const ufoY = () => 12 + Math.sin(t * 0.03) * 2.5;

  function step() {
    t++;
    // Idle drift, or ease toward the pointer
    const idle = 92 + Math.sin(t * 0.004) * 30;
    const goal = targetX ?? idle;
    ufoX += (Math.min(W - UFO_W / 2 - 4, Math.max(UFO_W / 2 + 4, goal)) - ufoX) * 0.02;
    if (flash > 0) flash--;

    for (let i = aliens.length - 1; i >= 0; i--) {
      const a = aliens[i];
      const w = spriteWidth(a);
      if (a.state === 'walk') {
        a.x += a.speed * a.dir;
        if (a.x < 2) a.dir = 1;
        if (a.x > W - w - 2) a.dir = -1;
        // Under the beam: lift off
        if (Math.abs(a.x + w / 2 - ufoX) < 1.5 && respawn === 0) {
          a.state = 'lift';
          a.lift = 0;
        }
      } else {
        a.lift += 1 / LIFT_STEPS;
        a.x += (ufoX - w / 2 - a.x) * 0.08;
        const top = ufoY() + UFO_H;
        const e = a.lift * a.lift * (3 - 2 * a.lift);
        a.y = GROUND - spriteHeight(a) + (top - (GROUND - spriteHeight(a))) * e;
        if (a.lift >= 1) {
          aliens.splice(i, 1);
          flash = 40;
          respawn = RESPAWN_STEPS;
        }
      }
    }

    if (respawn > 0 && --respawn === 0) {
      const fromLeft = Math.random() < 0.5;
      const a = makeAlien(0, fromLeft ? 1 : -1);
      a.x = fromLeft ? 2 : W - spriteWidth(a) - 2;
      aliens.push(a);
    }
  }

  function render() {
    px.fill(0);
    const uy = ufoY();
    const cx = ufoX;
    const hullBottom = uy + UFO_H;
    const lifting = aliens.some(a => a.state === 'lift');

    // Stars
    for (const s of stars) {
      const v = 0.5 + 0.5 * Math.sin(s.phase + t * s.rate);
      const tone = STAR_PX[ditherLevel(v, STAR.length - 1, s.x, s.y)];
      if (tone) px[s.y * W + s.x] = tone;
    }

    // Halo around the saucer and the tractor beam below it, dithered
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.06) + (lifting ? 0.12 : 0);
    for (let y = Math.max(0, Math.floor(uy - 10)); y <= GROUND; y++) {
      for (let x = 0; x < W; x++) {
        let v = 0;
        // Halo: an ellipse around the hull
        const hx = (x - cx) / 32;
        const hy = (y - (uy + UFO_H / 2)) / 15;
        v = Math.max(v, 0.32 * smoothstep(1, 0, Math.hypot(hx, hy)));
        // Beam: a cone from the hull to the ground, brighter near the top,
        // with scanlines travelling down it
        if (y > hullBottom) {
          const k = (y - hullBottom) / (GROUND - hullBottom);
          const half = 8 + k * 16;
          const d = Math.abs(x - cx) / half;
          if (d < 1) {
            const scan = (y - t * 0.35) % 9 < 2 ? 0.14 : 0;
            v = Math.max(v, (0.5 - 0.28 * k + scan) * smoothstep(1, 0.55, d) * pulse);
          }
        }
        if (v <= 0) continue;
        const tone = LICHEN_PX[ditherLevel(v, 3, x, y)];
        if (tone) px[y * W + x] = tone;
      }
    }

    // Ground: a dotted rule
    for (let x = 0; x < W; x += 2) px[(GROUND + 1) * W + x] = GROUND_PX;

    // Aliens
    for (const a of aliens) {
      const frame = a.sprite[Math.floor(t / WALK_FRAMES) % 2];
      const tones = a.amber ? AMBER_PX : LICHEN_PX;
      const ox = Math.round(a.x);
      const oy = Math.round(a.y);
      for (let r = 0; r < frame.length; r++) {
        for (let c = 0; c < frame[r].length; c++) {
          if (frame[r][c] !== '#') continue;
          const x = ox + c;
          const y = oy + r;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          // Lifted aliens fade into the beam as they rise
          const v = a.state === 'lift' ? 1 - a.lift * 0.6 : 1;
          const tone = tones[ditherLevel(v, tones.length - 1, x, y)];
          if (tone) px[y * W + x] = tone;
        }
      }
    }

    // Saucer
    const ox = Math.round(cx - UFO_W / 2);
    const oy = Math.round(uy);
    for (let cy = 0; cy < UFO_H; cy++) {
      for (let cxCell = 0; cxCell < UFO_W; cxCell++) {
        const r = Math.floor(cy / SCALE);
        const c = Math.floor(cxCell / SCALE);
        const ch = UFO[r][c];
        if (ch === '.') continue;
        const x = ox + cxCell;
        const y = oy + cy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        let tone: number;
        if (ch === 'A') {
          // Dome lit from the top right
          const v = 0.55 + 0.35 * (1 - r / 3) + 0.15 * (c / UFO[0].length);
          tone = AMBER_PX[ditherLevel(v, AMBER.length - 1, x, y)];
        } else if (ch === 'L') {
          const v = [0, 0, 0, 0.92, 0.82, 0.74, 0.64, 0.5][r];
          tone = LICHEN_PX[ditherLevel(v, LICHEN.length - 1, x, y)];
        } else {
          // Lights chase along the rim; all flash after an abduction
          const light = Math.floor(c / 3);
          const on = flash > 0 ? (flash >> 3) % 2 === 0 : (Math.floor(t / 10) + light) % 3 === 0;
          tone = on ? ROCK : AMBER_PX[2];
        }
        if (tone) px[y * W + x] = tone;
      }
    }

    ctx!.putImageData(image, 0, 0);
  }

  if (reducedMotion) {
    t = 120;
    render();
    return () => {};
  }

  let frameId = 0;
  let running = false;
  const clock = createClock();

  function loop(now: number) {
    const steps = clock.steps(now);
    for (let i = 0; i < steps; i++) step();
    if (steps) render();
    frameId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    clock.reset();
    frameId = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(frameId);
    running = false;
  }

  // Only animate while on screen
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) start();
    else stop();
  });
  observer.observe(canvas);

  // The saucer follows the pointer across the section. Layout is read in the
  // handler, not in rAF.
  const area = canvas.closest('section') ?? canvas.parentElement!;
  function onPointerMove(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    targetX = ((e.clientX - rect.left) / rect.width) * W;
  }
  function onPointerLeave() {
    targetX = null;
  }
  area.addEventListener('pointermove', onPointerMove);
  area.addEventListener('pointerleave', onPointerLeave);

  render();

  return () => {
    stop();
    observer.disconnect();
    area.removeEventListener('pointermove', onPointerMove);
    area.removeEventListener('pointerleave', onPointerLeave);
  };
}
