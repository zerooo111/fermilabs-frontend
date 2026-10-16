import { DitherRidge } from '@/shared/ui/dither-ridge';

/**
 * Initial-load overlay for the chart, in the boot splash's language: the
 * dithered depth ridge builds outward from the spread with amber order fills
 * flashing on its crest, and the splash's pixel loader under a mono eyebrow.
 * Fully static under prefers-reduced-motion (see dither-ridge.css).
 */
export function ChartLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-background"
    >
      <DitherRidge
        reveal
        fills={9}
        density={0.75}
        fringe={8}
        className="absolute inset-x-0 bottom-0 h-[42%] text-lichen [--ridge-alpha:0.18]"
      />
      <div className="relative mb-[8%] flex flex-col items-center gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-rock/50">
          Loading chart
        </span>
        <span className="pixel-loader" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
