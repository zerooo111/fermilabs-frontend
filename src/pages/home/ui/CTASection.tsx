import { useEffect, useRef } from 'react';

import { LINKS } from '../constants';
import { prefersReducedMotion } from '../lib/dither';
import { whenNear } from '../lib/useInView';

export default function CTASection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The UFO scene loads when the section comes near, like the order book field
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const stopWatching = whenNear(canvas, () => {
      import('../lib/alien-field')
        .then(({ initAlienField }) => {
          if (!cancelled)
            cleanup = initAlienField(canvas, { reducedMotion: prefersReducedMotion() });
        })
        .catch(error => console.error('Failed to load alien field:', error));
    });
    return () => {
      cancelled = true;
      stopWatching();
      cleanup?.();
    };
  }, []);

  return (
    <>
      <section className="w-full">
        <div className="frame reg relative isolate overflow-hidden px-5 py-16 md:px-10 md:py-24">
          {/* Hidden on phones, where the text spans the full width */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pixelated pointer-events-none absolute right-6 bottom-0 -z-10 hidden aspect-[150/110] w-[min(44%,520px)] md:block"
          />
          <h2 className="max-w-3xl font-serif text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.1] font-light tracking-[-0.03em]">
            Ready to experience the fastest DEX?
          </h2>
          <p className="mt-6 max-w-xl text-lg text-rock/70">
            Deploy liquidity, fire off your first trade, or dive into our SDK in minutes.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a
              href={LINKS.APP}
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer bg-amber-200 px-5 py-3 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100"
            >
              Try the Beta
            </a>
            <a href={LINKS.DISCORD} target="_blank" rel="noreferrer" className="link text-rock/85">
              Join the Discord
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
