import { useEffect, useRef } from 'react';

import { LINKS } from '../constants';
import { prefersReducedMotion } from '../lib/dither';
import { whenNear } from '../lib/useInView';

export default function CTASection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The dithered mark loads when the section comes near, like the order book field
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const stopWatching = whenNear(canvas, () => {
      import('../lib/logo-field')
        .then(({ initLogoField }) => {
          if (!cancelled)
            cleanup = initLogoField(canvas, { reducedMotion: prefersReducedMotion() });
        })
        .catch(error => console.error('Failed to load logo field:', error));
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
          <div aria-hidden="true" className="grid-patch absolute inset-y-0 right-0 -z-20 w-2/3" />
          <canvas
            ref={canvasRef}
            width="158"
            height="104"
            aria-hidden="true"
            className="pixelated pointer-events-none absolute -right-24 -bottom-20 -z-10 aspect-[158/104] w-[26rem] opacity-25 md:-right-4 md:-bottom-14 md:w-[42rem] md:opacity-50"
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
