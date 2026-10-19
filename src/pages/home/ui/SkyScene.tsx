import { useEffect, useRef } from 'react';

import { prefersReducedMotion } from '../lib/dither';

// Load the scene once the browser is idle so it never competes with first
// paint
const whenIdle = (fn: () => void) =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : window.setTimeout(fn, 200);

/**
 * The landing hero's sky: a twinkling star field behind the section and the
 * dithered UFO scene, which abducts the aliens walking under it. Place it in
 * a `relative isolate overflow-hidden` section; `ufoClassName` positions and
 * sizes the UFO canvas (aspect 150/110).
 */
export function SkyScene({ ufoClassName }: { ufoClassName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stars = starsRef.current;
    if (!canvas || !stars) return;
    const cleanups: (() => void)[] = [];
    let cancelled = false;
    const reducedMotion = prefersReducedMotion();
    whenIdle(() => {
      import('../lib/alien-field')
        .then(({ initAlienField }) => {
          if (!cancelled) cleanups.push(initAlienField(canvas, { reducedMotion }));
        })
        .catch(error => console.error('Failed to load alien field:', error));
      import('../lib/star-field')
        .then(({ initStarField }) => {
          if (!cancelled) cleanups.push(initStarField(stars, { reducedMotion }));
        })
        .catch(error => console.error('Failed to load star field:', error));
    });
    return () => {
      cancelled = true;
      cleanups.forEach(fn => fn());
    };
  }, []);

  return (
    <>
      <canvas
        ref={starsRef}
        aria-hidden="true"
        className="pixelated pointer-events-none absolute inset-0 -z-30 h-full w-full"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pixelated pointer-events-none absolute -z-10 aspect-[150/110] ${ufoClassName}`}
      />
    </>
  );
}
