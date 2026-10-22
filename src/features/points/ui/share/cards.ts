/**
 * Share cards for a wallet's ALIEN points: four alien-themed images, drawn on
 * a canvas at X's large-image size in the landing's pixel style. Each shows
 * the total, the rank and the wallet's own alien; the address can be hidden.
 */
import { BAYER } from '@/shared/lib/dither';
import { points, shortAddress, topShare } from '../../model/format';
import { alienSprite } from '../../model/alienSprite';

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

const NIGHT = '#001409';
const LICHEN = '#b4dc78';
const AMBER = '#fde68a';
const ROCK = '#f8f7e7';
const FOREST = '#185038';
const INK = '#0b2a1c';
const STAMP = '#b8322a';

const MONO = '"Paper Mono", ui-monospace, monospace';
const SERIF = 'Newsreader, Georgia, serif';
const SANS = 'Archivo, sans-serif';

// Sprites, as in the landing's UFO scene. Saucer: A dome, L hull, o lights.
const UFO = [
  '........AAAAAAA........',
  '......AAAAAAAAAAA......',
  '.....AAAAAAAAAAAAA.....',
  '..LLLLLLLLLLLLLLLLLLL..',
  'LLLLLLLLLLLLLLLLLLLLLLL',
  'LLoLLoLLoLLoLLoLLoLLoLL',
  'LLLLLLLLLLLLLLLLLLLLLLL',
  '...LLLLLLLLLLLLLLLLL...',
];
const CRAB = [
  '..#.....#..',
  '...#...#...',
  '..#######..',
  '.##.###.##.',
  '###########',
  '#.#######.#',
  '#.#.....#.#',
  '...##.##...',
];
const SQUID = [
  '...##...',
  '..####..',
  '.######.',
  '##.##.##',
  '########',
  '..#..#..',
  '.#.##.#.',
  '#.#..#.#',
];
const BUNKER = [
  '..#######..',
  '.#########.',
  '###########',
  '###########',
  '###########',
  '####...####',
  '###.....###',
  '###.....###',
];
// The Fermi mark, from logo.svg
const MARK = ['...#...', '..###..', '.##..#.', '##.####'];

// ─── drawing helpers ─────────────────────────────────────────────────

/** A pixel sprite: each character in `palette` is a `cell`-sized square of its color. */
function sprite(
  ctx: Ctx,
  rows: string[],
  x: number,
  y: number,
  cell: number,
  palette: Record<string, string>
) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = palette[row[i]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + i * cell, y + j * cell, cell, cell);
    }
  });
}

/** The wallet's alien (11 x 8 cells), in its own color unless one is given. */
function walletAlien(ctx: Ctx, wallet: string, x: number, y: number, cell: number, color?: string) {
  const { cells, color: own } = alienSprite(wallet);
  ctx.fillStyle = color ?? own;
  cells.forEach((row, j) =>
    row.forEach((on, i) => {
      if (on) ctx.fillRect(x + i * cell, y + j * cell, cell, cell);
    })
  );
}

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

function spacing(ctx: Ctx, px: number) {
  // Not in every browser yet; the text just sits a little tighter without it.
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

type TextStyle = {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  tracking?: number;
  alpha?: number;
};

function text(ctx: Ctx, s: string, x: number, y: number, style: TextStyle) {
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = style.alpha ?? 1;
  spacing(ctx, style.tracking ?? 0);
  ctx.fillText(s, x, y);
  spacing(ctx, 0);
  ctx.globalAlpha = 1;
}

function textWidth(ctx: Ctx, s: string, font: string, tracking = 0): number {
  ctx.font = font;
  spacing(ctx, tracking);
  const w = ctx.measureText(s).width;
  spacing(ctx, 0);
  return w;
}

/** The largest size, from `size` down, at which `s` fits in `maxW`. */
function fit(
  ctx: Ctx,
  s: string,
  maxW: number,
  size: number,
  font: (px: number) => string,
  tracking = 0
) {
  while (size > 16 && textWidth(ctx, s, font(size), tracking) > maxW) size -= 2;
  return size;
}

/** Fills a region with ordered dither: `level(x, y)` (0..1) sets how many cells light up. */
function dither(
  ctx: Ctx,
  x0: number,
  y0: number,
  w: number,
  h: number,
  cell: number,
  color: string,
  level: (x: number, y: number) => number
) {
  ctx.fillStyle = color;
  for (let cy = 0; cy * cell < h; cy++) {
    for (let cx = 0; cx * cell < w; cx++) {
      const x = x0 + cx * cell;
      const y = y0 + cy * cell;
      if (level(x + cell / 2, y + cell / 2) > BAYER[(cy & 7) * 8 + (cx & 7)]) {
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }
}

function stars(ctx: Ctx, rand: () => number, n: number, w: number, h: number) {
  for (let i = 0; i < n; i++) {
    const size = rand() < 0.15 ? 4 : 2;
    ctx.globalAlpha = 0.15 + rand() * 0.55;
    ctx.fillStyle = rand() < 0.2 ? LICHEN : ROCK;
    ctx.fillRect(Math.round(rand() * w), Math.round(rand() * h), size, size);
  }
  ctx.globalAlpha = 1;
}

function scanlines(ctx: Ctx, alpha: number) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  for (let y = 0; y < CARD_H; y += 4) ctx.fillRect(0, y, CARD_W, 1);
}

const LINK = 'fermi.trade/points';
const LINK_FONT = `400 22px ${MONO}`;

/** The Fermi mark and the link back, starting at x (or ending there, with `right`). */
function brand(ctx: Ctx, x: number, baseline: number, color: string, right = false) {
  const cell = 6;
  const markW = MARK[0].length * cell;
  const gap = 16;
  const w = markW + gap + textWidth(ctx, LINK, LINK_FONT, 1);
  const left = right ? x - w : x;
  sprite(ctx, MARK, left, baseline - MARK.length * cell, cell, { '#': color });
  text(ctx, LINK, left + markW + gap, baseline, { font: LINK_FONT, color, tracking: 1 });
}

const address = (d: CardData) => (d.hideAddress ? null : shortAddress(d.wallet));

/** Rank as "#12" and "of 4,321". */
const rankParts = (d: CardData) =>
  d.rank === null
    ? null
    : [`#${d.rank.toLocaleString('en-US')}`, `of ${d.ranked.toLocaleString('en-US')}`];

// ─── the cards ───────────────────────────────────────────────────────

/** A saucer lifting the wallet's alien up its beam; the score on the left. */
function drawBeam(ctx: Ctx, d: CardData) {
  const sky = ctx.createLinearGradient(0, 0, 0, CARD_H);
  sky.addColorStop(0, '#000d06');
  sky.addColorStop(1, '#08291a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  stars(ctx, seeded(d.wallet), 110, CARD_W, 560);

  const cx = 900;
  const ground = 584;
  const ufoCell = 12;
  const ufoTop = 64;
  const beamTop = ufoTop + UFO.length * ufoCell;

  // The beam widens toward the ground and fades as it goes.
  dither(ctx, cx - 240, beamTop, 480, ground - beamTop, 6, LICHEN, (x, y) => {
    const t = (y - beamTop) / (ground - beamTop);
    const dx = Math.abs(x - cx) / (64 + t * 170);
    return dx > 1 ? 0 : (0.6 - 0.3 * t) * (1 - dx * dx) + 0.06;
  });
  sprite(ctx, UFO, cx - (UFO[0].length * ufoCell) / 2, ufoTop, ufoCell, {
    A: AMBER,
    L: LICHEN,
    o: ROCK,
  });

  // The wallet's alien, mid-abduction, outlined in the night so it stands out
  // from the beam.
  const alienCell = 14;
  const ax = cx - (11 * alienCell) / 2;
  const ay = 292;
  for (const [ox, oy] of [
    [-6, 0],
    [6, 0],
    [0, -6],
    [0, 6],
  ]) {
    walletAlien(ctx, d.wallet, ax + ox, ay + oy, alienCell, '#03160c');
  }
  walletAlien(ctx, d.wallet, ax, ay, alienCell);

  // Dotted ground with two walkers waiting their turn.
  ctx.fillStyle = ROCK;
  ctx.globalAlpha = 0.3;
  for (let x = 0; x < CARD_W; x += 12) ctx.fillRect(x, ground, 5, 2);
  ctx.globalAlpha = 0.85;
  sprite(ctx, CRAB, 640, ground - 36, 4, { '#': AMBER });
  sprite(ctx, SQUID, 1100, ground - 36, 4, { '#': LICHEN });
  ctx.globalAlpha = 1;

  const left = 72;
  text(ctx, 'ALIEN POINTS · SEASON 1', left, 150, {
    font: `400 20px ${MONO}`,
    color: AMBER,
    tracking: 5,
  });
  const score = points(d.total);
  const size = fit(ctx, score, 540, 132, px => `400 ${px}px ${MONO}`, -4);
  text(ctx, score, left - 4, 290, { font: `400 ${size}px ${MONO}`, color: ROCK, tracking: -4 });
  text(ctx, 'points beamed aboard', left, 350, {
    font: `300 40px ${SERIF}`,
    color: ROCK,
    alpha: 0.75,
  });

  const rank = rankParts(d);
  if (rank && d.rank !== null) {
    const top = 400;
    const boxW = 250;
    ctx.strokeStyle = ROCK;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left + 0.5, top + 0.5, boxW, 104);
    ctx.strokeRect(left + boxW + 0.5, top + 0.5, boxW, 104);
    ctx.globalAlpha = 1;
    const label = { font: `400 16px ${MONO}`, color: ROCK, alpha: 0.55, tracking: 3 };
    text(ctx, 'RANK', left + 22, top + 36, label);
    text(ctx, 'STANDING', left + boxW + 22, top + 36, label);
    const valueFont = `400 40px ${MONO}`;
    text(ctx, rank[0], left + 22, top + 84, { font: valueFont, color: ROCK, tracking: -1 });
    const rankW = textWidth(ctx, rank[0], valueFont, -1);
    text(ctx, rank[1], left + 22 + rankW + 10, top + 84, {
      font: `400 18px ${MONO}`,
      color: ROCK,
      alpha: 0.55,
    });
    text(ctx, `Top ${topShare(d.rank, d.ranked)}`, left + boxW + 22, top + 84, {
      font: valueFont,
      color: AMBER,
      tracking: -1,
    });
  }

  text(ctx, address(d) ?? 'ADDRESS CLASSIFIED', left, 636, {
    font: `400 22px ${MONO}`,
    color: ROCK,
    alpha: 0.6,
    tracking: 1,
  });
  brand(ctx, CARD_W - left, 636, ROCK, true);
}

/** An arcade cabinet: the score as the high score, the wallet's alien as the player. */
function drawArcade(ctx: Ctx, d: CardData) {
  ctx.fillStyle = '#020a05';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Scoreboard along the top
  const label = { font: `400 20px ${MONO}`, color: ROCK, alpha: 0.55, tracking: 4 };
  const value = `400 30px ${MONO}`;
  const rank = rankParts(d);
  text(ctx, 'PLAYER 1', 72, 66, label);
  text(ctx, address(d) ?? '????????', 72, 106, { font: value, color: LICHEN, tracking: 1 });
  text(ctx, 'RANK', CARD_W / 2, 66, { ...label, align: 'center' });
  text(ctx, rank ? `${rank[0]} ${rank[1]}` : '---', CARD_W / 2, 106, {
    font: value,
    color: ROCK,
    align: 'center',
  });
  text(ctx, 'TOP', CARD_W - 72, 66, { ...label, align: 'right' });
  text(ctx, d.rank !== null ? topShare(d.rank, d.ranked) : '---', CARD_W - 72, 106, {
    font: value,
    color: AMBER,
    align: 'right',
  });

  // The invading fleet
  const cols = 11;
  const step = 72;
  const startX = (CARD_W - (cols - 1) * step - 44) / 2;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < cols; i++) {
    sprite(ctx, SQUID, startX + i * step + 6, 150, 4, { '#': AMBER });
    sprite(ctx, CRAB, startX + i * step, 200, 4, { '#': LICHEN });
  }
  ctx.globalAlpha = 1;

  text(ctx, 'ALIEN POINTS', CARD_W / 2, 300, {
    font: `400 22px ${MONO}`,
    color: AMBER,
    align: 'center',
    tracking: 8,
  });
  const score = points(d.total);
  const size = fit(ctx, score, 1000, 150, px => `400 ${px}px ${MONO}`, -4);
  ctx.shadowColor = LICHEN;
  ctx.shadowBlur = 32;
  text(ctx, score, CARD_W / 2, 420, {
    font: `400 ${size}px ${MONO}`,
    color: ROCK,
    align: 'center',
    tracking: -4,
  });
  ctx.shadowBlur = 0;

  // Bunkers, the player's shot and the player: the wallet's alien
  for (const x of [130, 360, 752, 982]) sprite(ctx, BUNKER, x, 474, 8, { '#': FOREST });
  ctx.fillStyle = AMBER;
  ctx.fillRect(CARD_W / 2 - 2, 470, 4, 22);
  walletAlien(ctx, d.wallet, CARD_W / 2 - 44, 512, 8);
  ctx.fillStyle = LICHEN;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, 592, CARD_W, 3);
  ctx.globalAlpha = 1;

  text(ctx, 'SEASON 1 · GAME ON', 72, 640, { ...label, font: `400 20px ${MONO}` });
  brand(ctx, CARD_W - 72, 640, ROCK, true);

  scanlines(ctx, 0.3);
  const vignette = ctx.createRadialGradient(
    CARD_W / 2,
    CARD_H / 2,
    260,
    CARD_W / 2,
    CARD_H / 2,
    760
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

/** A radar that just picked up the wallet's alien, with the readout beside it. */
function drawSignal(ctx: Ctx, d: CardData) {
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const rand = seeded(`signal:${d.wallet}`);

  const cx = 884;
  const cy = 334;
  const R = 262;
  const sweep = -0.7; // the beam's leading edge, radians

  // Sweep: bright at the leading edge, fading behind it.
  if ('createConicGradient' in ctx) {
    const span = 1.1;
    const g = ctx.createConicGradient(sweep - span, cx, cy);
    g.addColorStop(0, 'rgba(180, 220, 120, 0)');
    g.addColorStop(span / (2 * Math.PI), 'rgba(180, 220, 120, 0.38)');
    g.addColorStop(span / (2 * Math.PI) + 0.001, 'rgba(180, 220, 120, 0)');
    g.addColorStop(1, 'rgba(180, 220, 120, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = LICHEN;
  ctx.lineWidth = 2;
  for (const [r, alpha] of [
    [R, 0.6],
    [R * 0.75, 0.25],
    [R * 0.5, 0.25],
    [R * 0.25, 0.25],
  ]) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  for (let deg = 0; deg < 360; deg += 5) {
    const a = (deg * Math.PI) / 180;
    const len = deg % 30 === 0 ? 14 : 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Stray blips
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    const r = (0.2 + rand() * 0.7) * R;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    ctx.fillStyle = LICHEN;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(x - 6, y - 6, 12, 12);
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;

  // The contact: the wallet's alien just behind the sweep, locked in brackets.
  const a = sweep - 0.32;
  const tx = cx + Math.cos(a) * R * 0.52;
  const ty = cy + Math.sin(a) * R * 0.52;
  const cell = 8;
  const aw = 11 * cell;
  const ah = 8 * cell;
  ctx.shadowColor = LICHEN;
  ctx.shadowBlur = 20;
  walletAlien(ctx, d.wallet, tx - aw / 2, ty - ah / 2, cell);
  ctx.shadowBlur = 0;
  const pad = 16;
  const bx = tx - aw / 2 - pad;
  const by = ty - ah / 2 - pad;
  const bw = aw + pad * 2;
  const bh = ah + pad * 2;
  const arm = 16;
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [x, y, sx, sy] of [
    [bx, by, 1, 1],
    [bx + bw, by, -1, 1],
    [bx, by + bh, 1, -1],
    [bx + bw, by + bh, -1, -1],
  ]) {
    ctx.moveTo(x + sx * arm, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * arm);
  }
  ctx.stroke();
  text(ctx, `ID ${address(d) ?? 'UNKNOWN'}`, bx, by + bh + 26, {
    font: `400 16px ${MONO}`,
    color: AMBER,
    tracking: 2,
  });

  // The readout
  const left = 72;
  ctx.fillStyle = AMBER;
  ctx.fillRect(left, 82, 14, 14);
  text(ctx, 'INCOMING TRANSMISSION', left + 30, 96, {
    font: `400 22px ${MONO}`,
    color: AMBER,
    tracking: 5,
  });
  ctx.fillStyle = ROCK;
  ctx.globalAlpha = 0.25;
  for (let x = left; x < 560; x += 10) ctx.fillRect(x, 126, 5, 2);
  ctx.globalAlpha = 1;

  const row = (label: string, value: string, y: number, color = ROCK) => {
    text(ctx, `> ${label}`, left, y, { font: `400 22px ${MONO}`, color: ROCK, alpha: 0.5 });
    text(ctx, value, left + 200, y, { font: `400 22px ${MONO}`, color });
  };
  row('ORIGIN', address(d) ?? '[REDACTED]', 178);

  text(ctx, 'ALIEN POINTS DETECTED', left, 252, {
    font: `400 18px ${MONO}`,
    color: LICHEN,
    tracking: 5,
  });
  const score = points(d.total);
  const size = fit(ctx, score, 500, 112, px => `400 ${px}px ${MONO}`, -3);
  text(ctx, score, left - 3, 352, { font: `400 ${size}px ${MONO}`, color: ROCK, tracking: -3 });

  const rank = rankParts(d);
  if (rank && d.rank !== null) {
    row('RANK', `${rank[0]} ${rank[1]}`, 424);
    row('STANDING', `TOP ${topShare(d.rank, d.ranked)}`, 464, AMBER);
  }

  brand(ctx, left, 620, ROCK);
  scanlines(ctx, 0.18);
}

/** A specimen file on paper: the alien under glass, the points as the finding. */
function drawDossier(ctx: Ctx, d: CardData) {
  ctx.fillStyle = ROCK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const rand = seeded(`dossier:${d.wallet}`);

  // Graph paper and a little grain
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.06;
  for (let x = 0; x < CARD_W; x += 24) ctx.fillRect(x, 0, 1, CARD_H);
  for (let y = 0; y < CARD_H; y += 24) ctx.fillRect(0, y, CARD_W, 1);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 2400; i++) ctx.fillRect(rand() * CARD_W, rand() * CARD_H, 2, 2);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32.5, 32.5, CARD_W - 65, CARD_H - 65);

  const fileNo =
    d.rank !== null
      ? String(d.rank).padStart(5, '0')
      : String(Math.floor(rand() * 1e5)).padStart(5, '0');
  const kicker = { font: `400 16px ${MONO}`, color: INK, tracking: 5 };
  text(ctx, 'FERMI RESEARCH DIVISION', 56, 72, kicker);
  text(ctx, `SPECIMEN FILE No. ${fileNo}`, CARD_W - 56, 72, { ...kicker, align: 'right' });
  ctx.fillStyle = INK;
  ctx.fillRect(32, 92, CARD_W - 64, 1.5);

  // The specimen, under glass, with a ruler on two sides
  const box = { x: 64, y: 124, w: 420, h: 420 };
  ctx.fillStyle = FOREST;
  ctx.globalAlpha = 0.07;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = INK;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w, box.h);
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  for (let i = 0; i <= box.w; i += 20) {
    const len = i % 100 === 0 ? 12 : 6;
    ctx.fillRect(box.x + i, box.y + box.h - len, 1.5, len);
    ctx.fillRect(box.x, box.y + i, len, 1.5);
  }
  ctx.globalAlpha = 1;
  const cell = 32;
  walletAlien(
    ctx,
    d.wallet,
    box.x + (box.w - 11 * cell) / 2,
    box.y + (box.h - 8 * cell) / 2,
    cell,
    FOREST
  );
  text(ctx, 'FIG. 1 — SPECIMEN, SCALE 32:1', box.x, 576, {
    font: `400 14px ${MONO}`,
    color: INK,
    alpha: 0.65,
    tracking: 2,
  });

  // The findings
  const left = 528;
  const right = CARD_W - 64;
  const label = { font: `400 15px ${MONO}`, color: INK, alpha: 0.6, tracking: 4 };
  text(ctx, 'SUBJECT', left, 150, label);
  const addr = address(d);
  if (addr) {
    text(ctx, addr, left, 192, { font: `400 30px ${MONO}`, color: INK, tracking: 1 });
  } else {
    ctx.fillStyle = INK;
    ctx.fillRect(left, 166, 190, 32);
    ctx.fillRect(left + 202, 166, 96, 32);
  }

  text(ctx, 'ALIEN POINTS RECOVERED', left, 254, label);
  const score = points(d.total);
  const size = fit(ctx, score, right - left, 132, px => `300 ${px}px ${SERIF}`, -3);
  text(ctx, score, left - 4, 360, { font: `300 ${size}px ${SERIF}`, color: INK, tracking: -3 });

  const rank = rankParts(d);
  const rows: [string, string][] = [
    ['RANK', rank ? `${rank[0]} ${rank[1]}` : 'Pending'],
    [
      'CLASSIFICATION',
      d.rank !== null ? `Top ${topShare(d.rank, d.ranked)} of wallets` : 'Unranked',
    ],
  ];
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(left, 404, right - left, 1);
  ctx.globalAlpha = 1;
  rows.forEach(([k, v], i) => {
    const y = 444 + i * 52;
    text(ctx, k, left, y, label);
    text(ctx, v, right, y, { font: `400 24px ${MONO}`, color: INK, align: 'right' });
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(left, y + 18, right - left, 1);
    ctx.globalAlpha = 1;
  });

  brand(ctx, 64, 630, INK);
  stamp(ctx, d.hideAddress ? 'CLASSIFIED' : 'CONFIRMED ALIEN', 880, 592, rand);
}

/** A rubber stamp: double border, worn ink, set at an angle. */
function stamp(ctx: Ctx, label: string, cx: number, cy: number, rand: () => number) {
  const font = `800 36px ${SANS}`;
  const w = Math.ceil(textWidth(ctx, label, font, 6)) + 64;
  const h = 84;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const s = off.getContext('2d');
  if (!s) return;
  s.strokeStyle = STAMP;
  s.lineWidth = 5;
  s.strokeRect(4, 4, w - 8, h - 8);
  s.lineWidth = 2;
  s.strokeRect(14, 14, w - 28, h - 28);
  text(s, label, w / 2, h / 2 + 13, { font, color: STAMP, align: 'center', tracking: 6 });
  // Wear: knock specks out of the ink.
  s.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 700; i++) {
    const size = 1 + rand() * 3;
    s.globalAlpha = 0.4 + rand() * 0.6;
    s.fillRect(rand() * w, rand() * h, size, size);
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.globalAlpha = 0.85;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(off, -w / 2, -h / 2);
  ctx.restore();
}

export const CARDS = [
  { id: 'beam', name: 'Beamed up', draw: drawBeam },
  { id: 'arcade', name: 'Invaders', draw: drawArcade },
  { id: 'signal', name: 'Transmission', draw: drawSignal },
  { id: 'dossier', name: 'Specimen file', draw: drawDossier },
] as const;

export type CardId = (typeof CARDS)[number]['id'];

let fonts: Promise<unknown> | null = null;

/** The page's fonts, which canvas text only uses once they've loaded. */
function loadFonts() {
  fonts ??= Promise.all(
    [`400 40px "Paper Mono"`, '300 40px Newsreader', '800 40px Archivo'].map(f =>
      document.fonts.load(f)
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
