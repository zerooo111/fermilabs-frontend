// Dithered UFO scene beside the hero headline. A pixel saucer bobs
// over the empty side of the section, its tractor beam sweeping the ground;
// space-invader aliens walk along a dotted ground line, and any that wanders
// under the beam is lifted into the saucer while a new one walks in. Same
// rendering as the order book field: one canvas cell per 3 CSS pixels,
// ordered-dithered into lichen and amber tones over the page background.

import {
  CRAB,
  SQUID,
  UFO_H,
  UFO_W,
  renderAlienScene,
  spriteHeight,
  spriteWidth,
  type Alien,
  type Star,
} from '@/shared/lib/alien-scene';
import { createClock } from './dither';

const W = 150; // cells
const H = 110;
const GROUND = 100; // ground line row

const LIFT_STEPS = 150;
const RESPAWN_STEPS = 90;

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
    renderAlienScene(px, W, H, {
      t,
      ufoX,
      ufoY: ufoY(),
      flash,
      ground: GROUND,
      stars,
      aliens,
    });
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
