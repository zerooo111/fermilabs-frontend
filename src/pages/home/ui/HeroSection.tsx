import { useEffect, useRef } from 'react';

import { LINKS } from '../constants';
import { prefersReducedMotion } from '../lib/dither';

// Load the UFO scene once the browser is idle so it never competes with first
// paint
const whenIdle = (fn: () => void) =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : window.setTimeout(fn, 200);

export default function HeroSection() {
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
    <section className="w-full">
      <div className="frame border-b border-rock/15 relative isolate overflow-hidden px-5 pt-16 pb-12 md:px-10 md:pt-24 md:pb-16">
        <canvas
          ref={starsRef}
          aria-hidden="true"
          className="pixelated pointer-events-none absolute inset-0 -z-30 h-full w-full"
        />
        {/* Hidden on phones, where the text spans the full width */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pixelated pointer-events-none absolute right-6 bottom-0 -z-10 hidden aspect-[150/110] w-[min(44%,520px)] md:block"
        />
        <p data-intro className="mb-6 text-xs tracking-[0.2em] text-rock/60 uppercase md:mb-8">
          Perpetuals on Solana
        </p>
        <h1
          data-intro
          className="max-w-5xl font-serif text-[clamp(2.75rem,7vw,6.25rem)] leading-[1.1] font-light tracking-[-0.03em]"
        >
          Instant finality.
          <br />
          Capital efficient.
        </h1>
        <p data-intro className="mt-6 max-w-xl text-lg text-rock/70 md:mt-8 md:text-xl">
          Trade with NASDAQ speed and onchain security, on an orderbook where no one cuts the line.
        </p>
        <div data-intro className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 md:mt-12">
          <a
            href={LINKS.APP}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer bg-amber-200 px-5 py-3 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100"
          >
            Try the Beta
          </a>
          <a href="#how" className="link text-rock/85">
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}
