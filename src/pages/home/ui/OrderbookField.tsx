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
      <figure className="frame reg relative h-[68vh] min-h-96 max-h-[640px]">
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
      </figure>
    </section>
  );
}
