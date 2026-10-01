import { useEffect, useRef } from 'react';

import { LINKS } from '../constants';
import { prefersReducedMotion } from '../lib/dither';

// Load the dithered mark once the browser is idle so it never competes with
// first paint
const whenIdle = (fn: () => void) =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : window.setTimeout(fn, 200);

export default function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    whenIdle(() => {
      import('../lib/logo-field')
        .then(({ initLogoField }) => {
          if (!cancelled)
            cleanup = initLogoField(canvas, { reducedMotion: prefersReducedMotion() });
        })
        .catch(error => console.error('Failed to load logo field:', error));
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <section className="w-full border-b border-rock/15">
      <div className="frame relative isolate overflow-hidden px-5 pt-16 pb-12 md:px-10 md:pt-24 md:pb-16">
        <canvas
          ref={canvasRef}
          width="158"
          height="104"
          aria-hidden="true"
          className="pixelated pointer-events-none absolute -right-24 -bottom-20 -z-10 aspect-[158/104] w-[26rem] opacity-25 md:-right-4 md:-bottom-14 md:w-[42rem] md:opacity-50"
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
