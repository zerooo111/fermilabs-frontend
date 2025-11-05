interface NoiseOverlayProps {
  opacity?: number;
  scale?: number;
  className?: string;
}

export default function NoiseOverlay({
  opacity = 1,
  scale = 1,
  className = '',
}: NoiseOverlayProps) {
  return (
    <div
      className={`fixed inset-0 w-full h-full pointer-events-none z-[10] mix-blend-soft-light ${className}`}
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Noise overlay texture"
        role="img"
      >
        <defs>
          <filter id="noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={0.9 * scale}
              numOctaves={4}
              stitchTiles="stitch"
            />
            <feComponentTransfer>
              <feFuncA type="discrete" tableValues="0 .5 .5 .7 .8 .9 1" />
            </feComponentTransfer>
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#noise)" opacity={opacity} />
      </svg>
    </div>
  );
}
