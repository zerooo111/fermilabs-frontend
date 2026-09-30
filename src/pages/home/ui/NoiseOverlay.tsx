interface NoiseOverlayProps {
  opacity?: number;
  scale?: number;
  className?: string;
}

// Film grain over the page; soft-light also deepens the greens. /noise.png is
// the old live feTurbulence filter (fractalNoise 0.9, 4 octaves, stitched)
// rendered once at 2x, so it looks the same without phones re-rasterising the
// filter while they scroll. `scale` shrinks the grain like baseFrequency did.
export default function NoiseOverlay({
  opacity = 1,
  scale = 1,
  className = '',
}: NoiseOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-[10] mix-blend-soft-light bg-[url(/noise.png)] bg-repeat ${className}`}
      style={{ opacity, backgroundSize: `${256 / scale}px` }}
    />
  );
}
