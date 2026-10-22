/**
 * Share cards for a wallet's ALIEN points, at X's large-image size. They're
 * drawn like the landing: a drawing-sheet frame, a light serif number, and
 * art on a coarse cell grid, ordered-dithered into the UFO scene's tones (the
 * first and last cards are a still frame of that scene, from the same
 * renderer). Each shows the wallet's own alien; the address can be hidden.
 */
import {
  CRAB,
  NIGHT,
  SQUID,
  UFO_H,
  renderAlienScene,
  smoothstep,
  type Alien,
  type ScenePalette,
} from '@/shared/lib/alien-scene';
import { ditherLevel, packColor, type RGB } from '@/shared/lib/dither';
import { alienSprite } from '../../model/alienSprite';
import { points, shortAddress, topShare } from '../../model/format';

export const CARD_W = 1200;
export const CARD_H = 675;

export type CardData = {
  wallet: string;
  total: number;
  rank: number | null;
  ranked: number;
  hideAddress: boolean;
};

type Ctx = CanvasRenderingContext2D;

// The art's grid: one cell is 5 px, so the dither still reads once X shrinks
// the card into a feed.
const CELL = 5;
const COLS = CARD_W / CELL;
const ROWS = CARD_H / CELL;

// The drawing sheet: a hairline frame, the footer band along its bottom.
const FRAME = 30;
const FOOT = 555;
const LEFT = 80;
const RIGHT = CARD_W - 80;
const ART = {
  x0: FRAME / CELL,
  x1: (CARD_W - FRAME) / CELL,
  y0: FRAME / CELL,
  y1: FOOT / CELL,
};

const NIGHT_BG = '#001409';
const PAPER_BG = '#f8f7e7';

const SERIF = 'Newsreader, Georgia, serif';
const SANS = 'Archivo, sans-serif';
const MONO = '"Paper Mono", ui-monospace, monospace';

/** Colors for the type and rules over the art. */
type Ink = { fg: string; muted: string; rule: string; mark: string; accent: string };

const NIGHT_INK: Ink = {
  fg: '#f8f7e7',
  muted: 'rgba(248, 247, 231, 0.6)',
  rule: 'rgba(248, 247, 231, 0.14)',
  mark: 'rgba(253, 230, 138, 0.7)',
  accent: '#fde68a',
};
const PAPER_INK: Ink = {
  fg: '#0b2a1c',
  muted: 'rgba(11, 42, 28, 0.62)',
  rule: 'rgba(11, 42, 28, 0.2)',
  mark: 'rgba(11, 42, 28, 0.55)',
  accent: '#8a5a00',
};

const pack = (tones: (RGB | null)[]) => tones.map(packColor);

/** The UFO scene printed in forest and ochre inks on paper. */
const PAPER: ScenePalette = {
  lichen: pack([null, [212, 220, 194], [156, 180, 146], [70, 114, 86], [24, 80, 56]]),
  amber: pack([null, [234, 220, 176], [208, 178, 108], [164, 118, 30], [116, 78, 6]]),
  star: pack([null, [216, 216, 198], [152, 162, 142], [62, 82, 68]]),
  rock: packColor([184, 50, 42]),
  ground: packColor([160, 168, 148]),
};

// The Fermi mark, from logo.svg
const MARK = ['...#...', '..###..', '.##..#.', '##.####'];

// ─── helpers ─────────────────────────────────────────────────────────

/** The same random numbers for the same seed, so a wallet's card never changes. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A card-sized grid of cells to dither into, then drawn scaled up, unsmoothed. */
function cells() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS;
  canvas.height = ROWS;
  const g = canvas.getContext('2d')!;
  const image = g.createImageData(COLS, ROWS);
  const px = new Uint32Array(image.data.buffer);
  return {
    px,
    /** Fills cells by level: `v(x, y)` (0..1) picks the tone, dithered. */
    shade(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      tones: number[],
      v: (x: number, y: number) => number
    ) {
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(ROWS, y1); y++) {
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(COLS, x1); x++) {
          const tone = tones[ditherLevel(v(x, y), tones.length - 1, x, y)];
          if (tone) px[y * COLS + x] = tone;
        }
      }
    },
    /** Keeps the art inside the frame, above the footer. */
    clip() {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (x < ART.x0 || x >= ART.x1 || y < ART.y0 || y >= ART.y1) px[y * COLS + x] = 0;
        }
      }
    },
    draw(ctx: Ctx) {
      g.putImageData(image, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, CARD_W, CARD_H);
    },
  };
}

/** The wallet's alien as rows of `#` and `.`, and as a two-frame scene sprite. */
function walletSprite(wallet: string) {
  const { cells: grid, amber } = alienSprite(wallet);
  const rows = grid.map(row => row.map(on => (on ? '#' : '.')).join(''));
  return { rows, sprite: [rows, rows], amber };
}

function walker(sprite: string[][], x: number, ground: number, amber: boolean): Alien {
  const y = ground - sprite[0].length;
  return { sprite, x, y, dir: 1, speed: 0, amber, state: 'walk', lift: 0 };
}

/** A few stars inside the frame, still (rate 0). */
function stars(rand: () => number, n: number, maxY: number) {
  return Array.from({ length: n }, () => ({
    x: Math.floor(ART.x0 + rand() * (ART.x1 - ART.x0)),
    y: Math.floor(ART.y0 + rand() * (maxY - ART.y0)),
    phase: rand() * Math.PI * 2,
    rate: 0,
  }));
}

function spacing(ctx: Ctx, px: number) {
  // Not in every browser yet; the text just sits a little tighter without it.
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

type TextStyle = { font: string; color: string; align?: CanvasTextAlign; tracking?: number };

function text(ctx: Ctx, s: string, x: number, y: number, style: TextStyle) {
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  spacing(ctx, style.tracking ?? 0);
  ctx.fillText(s, x, y);
  spacing(ctx, 0);
}

function width(ctx: Ctx, s: string, font: string, tracking = 0): number {
  ctx.font = font;
  spacing(ctx, tracking);
  const w = ctx.measureText(s).width;
  spacing(ctx, 0);
  return w;
}

const NUMBER_FONT = (px: number) => `300 ${px}px ${SERIF}`;

/** The hairline frame with registration marks on its corners, and the footer rule. */
function sheet(ctx: Ctx, ink: Ink, footRule = true) {
  ctx.strokeStyle = ink.rule;
  ctx.lineWidth = 1;
  ctx.strokeRect(FRAME + 0.5, FRAME + 0.5, CARD_W - FRAME * 2 - 1, CARD_H - FRAME * 2 - 1);
  if (footRule) {
    ctx.fillStyle = ink.rule;
    ctx.fillRect(FRAME, FOOT, CARD_W - FRAME * 2, 1);
  }
  ctx.strokeStyle = ink.mark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [x, y] of [
    [FRAME, FRAME],
    [CARD_W - FRAME, FRAME],
    [FRAME, CARD_H - FRAME],
    [CARD_W - FRAME, CARD_H - FRAME],
    [FRAME, FOOT],
    [CARD_W - FRAME, FOOT],
  ]) {
    ctx.moveTo(x - 9, y + 0.5);
    ctx.lineTo(x + 9, y + 0.5);
    ctx.moveTo(x + 0.5, y - 9);
    ctx.lineTo(x + 0.5, y + 9);
  }
  ctx.stroke();
}

/** The words: kicker, the number, rank, and the footer with the link back. */
function copy(ctx: Ctx, d: CardData, ink: Ink, maxW = 560) {
  text(ctx, 'ALIEN POINTS · SEASON 1', LEFT, 104, {
    font: `500 15px ${SANS}`,
    color: ink.muted,
    tracking: 3.5,
  });
  if (!d.hideAddress) {
    text(ctx, shortAddress(d.wallet), RIGHT, 104, {
      font: `400 16px ${MONO}`,
      color: ink.muted,
      align: 'right',
      tracking: 0.5,
    });
  }

  const score = points(d.total);
  let size = 196;
  while (size > 60 && width(ctx, score, NUMBER_FONT(size), -size * 0.03) > maxW) size -= 4;
  text(ctx, score, LEFT - size * 0.04, 290, {
    font: NUMBER_FONT(size),
    color: ink.fg,
    tracking: -size * 0.03,
  });
  text(ctx, 'points earned on Fermi Trade', LEFT, 344, {
    font: `400 26px ${SANS}`,
    color: ink.muted,
  });

  if (d.rank !== null) {
    const big = `300 54px ${SERIF}`;
    const small = `400 20px ${SANS}`;
    const rank = `#${d.rank.toLocaleString('en-US')}`;
    const of = `of ${d.ranked.toLocaleString('en-US')}`;
    text(ctx, rank, LEFT, 458, { font: big, color: ink.fg, tracking: -1 });
    let x = LEFT + width(ctx, rank, big, -1) + 12;
    text(ctx, of, x, 458, { font: small, color: ink.muted });
    x += width(ctx, of, small) + 28;
    ctx.fillStyle = ink.rule;
    ctx.fillRect(x, 418, 1, 48);
    x += 28;
    text(ctx, `Top ${topShare(d.rank, d.ranked)}`, x, 458, {
      font: big,
      color: ink.accent,
      tracking: -1,
    });
  }

  // Footer: the mark and name, the link back on the right
  const cell = 5;
  const markY = 612 - MARK.length * cell + 1;
  ctx.fillStyle = ink.fg;
  MARK.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '#') ctx.fillRect(LEFT + i * cell, markY + j * cell, cell, cell);
    }
  });
  text(ctx, 'Fermi Trade', LEFT + MARK[0].length * cell + 14, 612, {
    font: `500 24px ${SANS}`,
    color: ink.fg,
  });
  text(ctx, 'fermi.trade/points', RIGHT, 612, {
    font: `400 20px ${SANS}`,
    color: ink.muted,
    align: 'right',
  });
}

// ─── the cards ───────────────────────────────────────────────────────

/** The landing's UFO scene, caught lifting this wallet's alien up the beam. */
function abduction(ctx: Ctx, d: CardData, pal: ScenePalette, ink: Ink, bg: string) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const rand = seeded(`abduction:${d.wallet}`);
  const own = walletSprite(d.wallet);
  const ground = ART.y1 - 2;
  const ufoX = 178;
  const ufoY = 24;
  // Partway up the beam, eased as in the landing. The scene fades aliens by
  // how far they've risen; this one is the subject, so it barely fades.
  const rise = 0.42;
  const e = rise * rise * (3 - 2 * rise);
  const from = ground - own.rows.length;
  const lifted: Alien = {
    ...walker(own.sprite, ufoX - 5.5, ground, own.amber),
    state: 'lift',
    lift: 0.08,
    y: from + (ufoY + UFO_H - from) * e,
  };

  const grid = cells();
  renderAlienScene(
    grid.px,
    COLS,
    ROWS,
    {
      t: 132,
      ufoX,
      ufoY,
      flash: 0,
      ground,
      stars: stars(rand, 46, ground - 12),
      aliens: [walker(CRAB, 132, ground, !own.amber), walker(SQUID, 212, ground, false), lifted],
    },
    pal
  );
  grid.clip();
  grid.draw(ctx);

  // The scene's dotted ground stands in for the footer rule.
  sheet(ctx, ink, false);
  copy(ctx, d, ink);
}

/** The wallet's alien enlarged into lit, dithered tiles, like the footer's mark. */
function specimen(ctx: Ctx, d: CardData) {
  ctx.fillStyle = NIGHT_BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const rand = seeded(`specimen:${d.wallet}`);
  const own = walletSprite(d.wallet);
  const tile = 8; // cells per sprite pixel
  const ox = 132;
  const oy = 30;
  const grid = cells();

  // A soft pool of light behind the specimen
  const cx = ox + 44;
  const cy = oy + 34;
  grid.shade(
    cx - 70,
    cy - 46,
    cx + 70,
    cy + 52,
    NIGHT.lichen,
    (x, y) => 0.2 * smoothstep(1, 0, Math.hypot((x - cx) / 70, (y - cy) / 46))
  );

  // The sprite's grid, faint, then its lit tiles
  const body = own.amber ? NIGHT.amber : NIGHT.lichen;
  const crown = own.amber ? NIGHT.lichen : NIGHT.amber;
  own.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const x0 = ox + i * tile;
      const y0 = oy + j * tile;
      if (row[i] !== '#') {
        grid.shade(x0, y0, x0 + tile - 1, y0 + tile - 1, NIGHT.lichen, () => 0.07);
        continue;
      }
      // Lit from the top right, with a bevel: bright top edge, darker base
      const base = 0.36 + 0.26 * (1 - j / 7) + 0.12 * (i / 10) + (rand() - 0.5) * 0.12;
      grid.shade(x0, y0, x0 + tile - 1, y0 + tile - 1, j === 0 ? crown : body, (x, y) => {
        if (y === y0) return base + 0.3;
        if (x === x0 + tile - 2) return base + 0.08;
        if (y === y0 + tile - 2) return base - 0.14;
        return base;
      });
    }
  });
  grid.clip();

  // A faint 40 px grid behind the art, like the landing's hero surfaces
  ctx.fillStyle = 'rgba(248, 247, 231, 0.035)';
  for (let x = 640; x < CARD_W - FRAME; x += 40) ctx.fillRect(x, FRAME, 1, FOOT - FRAME);
  for (let y = FRAME + 40; y < FOOT; y += 40) ctx.fillRect(640, y, CARD_W - FRAME - 640, 1);
  grid.draw(ctx);

  const caption = { font: `400 14px ${MONO}`, color: NIGHT_INK.muted, tracking: 2 };
  const captionY = (oy + 64) * CELL + 40;
  text(ctx, 'FIG. 01 — SPECIMEN', ox * CELL, captionY, caption);
  text(ctx, '11 × 8', (ox + 88) * CELL - 8, captionY, { ...caption, align: 'right' });

  sheet(ctx, NIGHT_INK);
  copy(ctx, d, NIGHT_INK);
}

/** The alien's homeworld rising over the footer, the alien standing on top. */
function homeworld(ctx: Ctx, d: CardData) {
  ctx.fillStyle = NIGHT_BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const rand = seeded(`homeworld:${d.wallet}`);
  const own = walletSprite(d.wallet);
  const grid = cells();
  const P = { x: 190, y: 196, r: 128 };
  // Light from the upper right, away from the words
  const L = [0.62, -0.62, 0.48];
  const lambert = (dx: number, dy: number, z: number) =>
    Math.max(0, dx * L[0] + dy * L[1] + z * L[2]);

  // Craters on the visible cap: darker dishes with a lit far rim
  const craters = Array.from({ length: 9 }, () => {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.2;
    const r = P.r * (0.25 + rand() * 0.7);
    return { x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, r: 3 + rand() * 9 };
  });

  // Stars first, so the planet covers them
  for (const s of stars(rand, 52, ART.y1)) {
    const tone = NIGHT.star[ditherLevel(0.35 + 0.65 * rand(), NIGHT.star.length - 1, s.x, s.y)];
    if (tone) grid.px[s.y * COLS + s.x] = tone;
  }

  grid.shade(P.x - P.r - 8, P.y - P.r - 8, P.x + P.r + 8, ART.y1, NIGHT.lichen, (x, y) => {
    const dx = (x - P.x) / P.r;
    const dy = (y - P.y) / P.r;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1) {
      // Atmosphere: a thin glow, strongest on the lit side
      const out = (Math.sqrt(d2) - 1) * P.r;
      return out < 7 ? (0.1 + 0.3 * lambert(dx, dy, 0)) * (1 - out / 7) : 0;
    }
    // Capped below the brightest tone, so the planet stays a backdrop
    let v = 0.05 + 0.6 * lambert(dx, dy, Math.sqrt(1 - d2)) ** 1.4;
    for (const c of craters) {
      const k = Math.hypot(x - c.x, y - c.y) / c.r;
      if (k < 1) v *= 0.7 + 0.25 * k;
      else if (k < 1.25 && x > c.x && y < c.y) v += 0.08;
    }
    return v;
  });

  // A small amber moon
  const M = { x: 150, y: 26, r: 7 };
  grid.shade(M.x - M.r, M.y - M.r, M.x + M.r + 1, M.y + M.r + 1, NIGHT.amber, (x, y) => {
    const dx = (x - M.x) / M.r;
    const dy = (y - M.y) / M.r;
    const d2 = dx * dx + dy * dy;
    return d2 > 1 ? 0 : 0.15 + 0.85 * lambert(dx, dy, Math.sqrt(1 - d2));
  });

  // The alien on the summit
  const top = P.y - P.r - own.rows.length;
  const ax = P.x - 5;
  const tone = own.amber ? NIGHT.amber[4] : NIGHT.lichen[4];
  own.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '#') grid.px[(top + j) * COLS + ax + i] = tone;
    }
  });
  grid.clip();
  grid.draw(ctx);

  sheet(ctx, NIGHT_INK);
  copy(ctx, d, NIGHT_INK);
}

export const CARDS = [
  {
    id: 'abduction',
    name: 'Abduction',
    draw: (ctx: Ctx, d: CardData) => abduction(ctx, d, NIGHT, NIGHT_INK, NIGHT_BG),
  },
  { id: 'specimen', name: 'Specimen', draw: specimen },
  { id: 'homeworld', name: 'Homeworld', draw: homeworld },
  {
    id: 'print',
    name: 'Field print',
    draw: (ctx: Ctx, d: CardData) => abduction(ctx, d, PAPER, PAPER_INK, PAPER_BG),
  },
] as const;

export type CardId = (typeof CARDS)[number]['id'];

let fonts: Promise<unknown> | null = null;

/** The page's fonts, which canvas text only uses once they've loaded. */
function loadFonts() {
  fonts ??= Promise.all(
    ['300 40px Newsreader', '400 40px Archivo', '500 40px Archivo', '400 40px "Paper Mono"'].map(
      f => document.fonts.load(f)
    )
  ).catch(() => undefined);
  return fonts;
}

/** Draws one card and returns it as a PNG. */
export async function renderCard(id: CardId, data: CardData): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  CARDS.find(c => c.id === id)!.draw(ctx, data);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not encode the card'))),
      'image/png'
    )
  );
}
