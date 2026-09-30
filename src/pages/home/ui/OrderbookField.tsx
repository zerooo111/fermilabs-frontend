import { useEffect, useRef } from 'react';

import { prefersReducedMotion } from '../lib/dither';
import { whenNear } from '../lib/useInView';

export default function OrderbookField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    if (!canvas || !svg) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const stopWatching = whenNear(canvas, () => {
      import('../lib/orderbook-field')
        .then(({ initOrderbookField }) => {
          if (!cancelled)
            cleanup = initOrderbookField(canvas, {
              svg,
              reducedMotion: prefersReducedMotion(),
              lowPower: window.matchMedia('(pointer: coarse)').matches,
            });
        })
        .catch(error => console.error('Failed to load order book field:', error));
    });
    return () => {
      cancelled = true;
      stopWatching();
      cleanup?.();
    };
  }, []);

  return (
    <section id="how" className="w-full scroll-mt-14 border-b border-rock/15">
      <figure className="frame reg relative h-[52vh] min-h-80 max-h-[480px]">
        <canvas
          ref={canvasRef}
          className="pixelated edge-fade absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        <svg
          ref={svgRef}
          className="edge-fade pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        />
        <figcaption className="pointer-events-none absolute inset-0 text-xs text-rock/70">
          <span className="absolute top-4 left-5 border border-rock/25 bg-dark-forest px-2.5 py-1 md:left-10">
            Orders queue by price, then time
          </span>
          <span className="absolute right-5 bottom-4 border border-rock/25 bg-dark-forest px-2.5 py-1 md:right-10">
            and fill the moment they match
          </span>
        </figcaption>
      </figure>
    </section>
  );
}
