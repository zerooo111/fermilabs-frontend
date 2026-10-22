// The UFO scene's art and its renderer, shared by the landing's animation
// (pages/home/lib/alien-field) and the points share cards, which draw a still
// frame of it. One pixel per cell, ordered-dithered into lichen and amber
// tones; level 0 is left empty so the background shows through.

import { ditherLevel, packColor, type RGB } from './dither';

// Tones, darkest first. The low tones sit just above the page background
// (#001409).
export const LICHEN: (RGB | null)[] = [
  null,
  [8, 40, 26],
  [20, 66, 44],
  [72, 138, 84],
  [180, 220, 120],
];
export const AMBER: (RGB | null)[] = [
  null,
  [16, 40, 22],
  [56, 72, 36],
  [140, 132, 72],
  [253, 230, 138],
];
export const STAR: (RGB | null)[] = [null, [24, 52, 38], [96, 110, 96], [210, 210, 196]];

/** Packed tones for one rendering of the scene. */
export type ScenePalette = {
  lichen: number[];
  amber: number[];
  star: number[];
  rock: number;
  ground: number;
};

export const NIGHT: ScenePalette = {
  lichen: LICHEN.map(packColor),
  amber: AMBER.map(packColor),
  star: STAR.map(packColor),
  rock: packColor([248, 247, 231]),
  ground: packColor([44, 70, 56]),
};

// Saucer: A dome, L hull, o lights
export const UFO = [
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
export const SCALE = 2;
export const UFO_W = UFO[0].length * SCALE; // cells
export const UFO_H = UFO.length * SCALE;

// Two species, two frames each
export const CRAB = [
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
export const SQUID = [
  ['...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#'],
  ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'],
];

export type Alien = {
  sprite: string[][];
  x: number; // left edge, cells
  y: number; // top edge, cells
  dir: 1 | -1;
  speed: number;
  amber: boolean;
  state: 'walk' | 'lift';
  lift: number; // 0..1 while lifted
};

export type Star = { x: number; y: number; phase: number; rate: number };

export const WALK_FRAMES = 22; // steps per sprite frame

export function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function spriteHeight(a: Alien) {
  return a.sprite[0].length;
}

export function spriteWidth(a: Alien) {
  return a.sprite[0][0].length;
}

/** One moment of the scene. */
export type SceneState = {
  t: number; // steps
  ufoX: number; // saucer centre, cells
  ufoY: number; // saucer top, cells
  flash: number; // steps of light flash left after an abduction
  ground: number; // ground line row
  stars: Star[];
  aliens: Alien[];
};

/** Draws the scene into a w x h buffer of packed pixels. */
export function renderAlienScene(
  px: Uint32Array,
  w: number,
  h: number,
  s: SceneState,
  pal: ScenePalette = NIGHT
) {
  px.fill(0);
  const { t, flash, ground } = s;
  const uy = s.ufoY;
  const cx = s.ufoX;
  const hullBottom = uy + UFO_H;
  const lifting = s.aliens.some(a => a.state === 'lift');

  // Stars
  for (const star of s.stars) {
    const v = 0.5 + 0.5 * Math.sin(star.phase + t * star.rate);
    const tone = pal.star[ditherLevel(v, pal.star.length - 1, star.x, star.y)];
    if (tone) px[star.y * w + star.x] = tone;
  }

  // Halo around the saucer and the tractor beam below it, dithered
  const pulse = 0.85 + 0.15 * Math.sin(t * 0.06) + (lifting ? 0.12 : 0);
  for (let y = Math.max(0, Math.floor(uy - 10)); y <= ground; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      // Halo: an ellipse around the hull
      const hx = (x - cx) / 32;
      const hy = (y - (uy + UFO_H / 2)) / 15;
      v = Math.max(v, 0.32 * smoothstep(1, 0, Math.hypot(hx, hy)));
      // Beam: a cone from the hull to the ground, brighter near the top,
      // with scanlines travelling down it
      if (y > hullBottom) {
        const k = (y - hullBottom) / (ground - hullBottom);
        const half = 8 + k * 16;
        const d = Math.abs(x - cx) / half;
        if (d < 1) {
          const scan = (y - t * 0.35) % 9 < 2 ? 0.14 : 0;
          v = Math.max(v, (0.5 - 0.28 * k + scan) * smoothstep(1, 0.55, d) * pulse);
        }
      }
      if (v <= 0) continue;
      const tone = pal.lichen[ditherLevel(v, 3, x, y)];
      if (tone) px[y * w + x] = tone;
    }
  }

  // Ground: a dotted rule
  for (let x = 0; x < w; x += 2) px[(ground + 1) * w + x] = pal.ground;

  // Aliens
  for (const a of s.aliens) {
    const frame = a.sprite[Math.floor(t / WALK_FRAMES) % 2];
    const tones = a.amber ? pal.amber : pal.lichen;
    const ox = Math.round(a.x);
    const oy = Math.round(a.y);
    for (let r = 0; r < frame.length; r++) {
      for (let c = 0; c < frame[r].length; c++) {
        if (frame[r][c] !== '#') continue;
        const x = ox + c;
        const y = oy + r;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        // Lifted aliens fade into the beam as they rise
        const v = a.state === 'lift' ? 1 - a.lift * 0.6 : 1;
        const tone = tones[ditherLevel(v, tones.length - 1, x, y)];
        if (tone) px[y * w + x] = tone;
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
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      let tone: number;
      if (ch === 'A') {
        // Dome lit from the top right
        const v = 0.55 + 0.35 * (1 - r / 3) + 0.15 * (c / UFO[0].length);
        tone = pal.amber[ditherLevel(v, pal.amber.length - 1, x, y)];
      } else if (ch === 'L') {
        const v = [0, 0, 0, 0.92, 0.82, 0.74, 0.64, 0.5][r];
        tone = pal.lichen[ditherLevel(v, pal.lichen.length - 1, x, y)];
      } else {
        // Lights chase along the rim; all flash after an abduction
        const light = Math.floor(c / 3);
        const on = flash > 0 ? (flash >> 3) % 2 === 0 : (Math.floor(t / 10) + light) % 3 === 0;
        tone = on ? pal.rock : pal.amber[2];
      }
      if (tone) px[y * w + x] = tone;
    }
  }
}
