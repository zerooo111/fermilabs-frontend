/**
 * AccountAvatar.tsx
 * Square account mark: the user's social avatar when there is one, otherwise a
 * pixel identicon derived from the wallet address, so every account has a
 * stable, recognisable glyph in the same pixel language as the Fermi mark.
 */
import { useMemo, useState } from 'react';
import bs58 from 'bs58';
import { cn } from '@/lib/utils';

const GRID = 5;
// Columns 0–2 are drawn and mirrored onto 4–3, like a classic identicon.
const HALF = Math.ceil(GRID / 2);

/** 0 = empty, 1 = half tone, 2 = full tone. */
function identiconCells(address: string): number[][] {
  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(address);
  } catch {
    bytes = new TextEncoder().encode(address);
  }
  return Array.from({ length: GRID }, (_, row) => {
    const half = Array.from(
      { length: HALF },
      (_, col) => bytes[(row * HALF + col) % bytes.length] % 3
    );
    return [...half, ...half.slice(0, GRID - HALF).reverse()];
  });
}

function Identicon({ address }: { address: string }) {
  const cells = useMemo(() => identiconCells(address), [address]);
  return (
    <svg
      viewBox={`-1 -1 ${GRID + 2} ${GRID + 2}`}
      shapeRendering="crispEdges"
      className="size-full bg-dark-forest"
      aria-hidden
    >
      {cells.flatMap((row, y) =>
        row.map((tone, x) =>
          tone ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              className="fill-lichen"
              fillOpacity={tone === 2 ? 1 : 0.45}
            />
          ) : null
        )
      )}
    </svg>
  );
}

interface AccountAvatarProps {
  address: string;
  avatarUrl?: string | null;
  className?: string;
}

export function AccountAvatar({ address, avatarUrl, className }: AccountAvatarProps) {
  // Fall back to the identicon if the social avatar fails to load.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = avatarUrl && failedUrl !== avatarUrl;

  return (
    <span className={cn('block shrink-0 overflow-hidden', className)}>
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : (
        <Identicon address={address} />
      )}
    </span>
  );
}
