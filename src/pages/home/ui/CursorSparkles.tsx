/**
 * Pixel stars that sparkle around the mouse and trail it, like the stars in
 * the closing UFO scene. One fixed canvas over the page, drawn in 3px cells;
 * it ignores pointer events, sleeps when no star is alive, and is off for
 * touch screens and reduced motion.
 */
import { useEffect, useRef } from 'react';

import { createClock, prefersReducedMotion } from '../lib/dither';

const CELL = 3; // CSS pixels per cell
const MAX_STARS = 70;
const TRAIL_EVERY = 10; // CSS pixels of pointer travel per new star
const IDLE_EVERY = 16; // steps between stars while the pointer rests
const SPREAD = 36; // cells around the pointer (~110px)
const CORE = 3; // cells kept clear right under the pointer

// Dim to bright, the same tones as the UFO scene's stars; a star twinkles
// slowly up and back down these as it fades
const TONES = ['#0a2216', '#18342a', '#60705f', '#d2d2c4'];
const AMBER_TONES = ['#0a2216', '#28281a', '#8c8448', '#fde68a'];

type Star = {
  x: number; // cells
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  big: boolean;
  amber: boolean;
  phase: number;
  rate: number;
  dim: number; // 0..1, fainter further from the pointer
};

export function CursorSparkles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches)
      return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars: Star[] = [];
    let pointer: { x: number; y: number } | null = null;
    let travelled = 0;
    let idle = 0;
    let frameId = 0;
    let running = false;
    const clock = createClock();

    function resize() {
      canvas!.width = Math.ceil(window.innerWidth / CELL);
      canvas!.height = Math.ceil(window.innerHeight / CELL);
    }

    function spawn(near: { x: number; y: number }) {
      if (stars.length >= MAX_STARS) stars.shift();
      const a = Math.random() * Math.PI * 2;
      // Dense near the pointer, thinning out with distance: squaring a uniform
      // sample piles it toward 0 while keeping a long sparse tail
      const r = Math.random() ** 2;
      const d = CORE + (SPREAD - CORE) * r;
      stars.push({
        x: near.x / CELL + Math.cos(a) * d,
        y: near.y / CELL + Math.sin(a) * d,
        vx: (Math.random() - 0.5) * 0.02,
        vy: 0.005 + Math.random() * 0.015, // barely drifts, like settling dust
        age: 0,
        life: 90 + Math.random() * 90,
        big: Math.random() < 0.08,
        amber: Math.random() < 0.1,
        phase: Math.random() * Math.PI * 2,
        rate: 0.05 + Math.random() * 0.08,
        dim: r * 0.5,
      });
    }

    function step() {
      if (pointer && ++idle >= IDLE_EVERY) {
        idle = 0;
        spawn(pointer);
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.age++;
        s.x += s.vx;
        s.y += s.vy;
        if (s.age >= s.life) stars.splice(i, 1);
      }
    }

    function render() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const s of stars) {
        // Fade in, twinkle slowly, fade out
        const p = s.age / s.life;
        const env = Math.sin(Math.PI * p);
        const twinkle = 0.55 + 0.45 * Math.sin(s.phase + s.age * s.rate);
        const level = Math.min(3, Math.floor(env * twinkle * (1 - s.dim) * 4));
        if (level <= 0) continue;
        const tones = s.amber ? AMBER_TONES : TONES;
        const x = Math.round(s.x);
        const y = Math.round(s.y);
        ctx!.fillStyle = tones[level];
        ctx!.fillRect(x, y, 1, 1);
        // Bright big stars get a plus-shaped glint
        if (s.big && level >= 3) {
          ctx!.fillStyle = tones[1];
          ctx!.fillRect(x - 1, y, 1, 1);
          ctx!.fillRect(x + 1, y, 1, 1);
          ctx!.fillRect(x, y - 1, 1, 1);
          ctx!.fillRect(x, y + 1, 1, 1);
        }
      }
    }

    function loop(now: number) {
      const steps = clock.steps(now);
      for (let i = 0; i < steps; i++) step();
      if (steps) render();
      // Sleep once the last star is gone and the pointer has left
      if (!pointer && stars.length === 0) {
        render();
        running = false;
        return;
      }
      frameId = requestAnimationFrame(loop);
    }

    function wake() {
      if (running) return;
      running = true;
      clock.reset();
      frameId = requestAnimationFrame(loop);
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return;
      if (pointer) travelled += Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
      pointer = { x: e.clientX, y: e.clientY };
      while (travelled >= TRAIL_EVERY) {
        travelled -= TRAIL_EVERY;
        spawn(pointer);
      }
      wake();
    }

    function onPointerOut(e: PointerEvent) {
      // Left the window
      if (!e.relatedTarget) pointer = null;
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerout', onPointerOut);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerout', onPointerOut);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pixelated pointer-events-none fixed inset-0 z-[20] h-full w-full"
    />
  );
}
