/**
 * The sprite behind a wallet's alien: generated from the address, so the same
 * wallet always gets the same one. 11 x 8 pixels, mirrored down the middle.
 * The face, eyes and a joined-up body are fixed so every seed reads as a
 * creature; antennae, shoulders, arms and feet vary.
 */
import bs58 from 'bs58';

export const W = 11;
export const H = 8;
const HALF = 6; // columns 0..5; column 5 is the middle

/** The landing's alien colors: mostly lichen, about a third amber, as in its UFO scene. */
const LICHEN = '#b4dc78';
const AMBER = '#fde68a';

function seedBytes(wallet: string): Uint8Array {
  try {
    const bytes = bs58.decode(wallet);
    if (bytes.length) return bytes;
  } catch {
    // Not base58: fall through to a char-code seed.
  }
  return Uint8Array.from(wallet, c => c.charCodeAt(0) & 255);
}

export function alienSprite(wallet: string): {
  cells: boolean[][];
  color: string;
  amber: boolean;
} {
  const bytes = seedBytes(wallet);
  const bit = (i: number) => (bytes[(i >> 3) % bytes.length] >> (i & 7)) & 1;
  const on = (b: number) => bit(b) === 1;
  // hx: distance from the left edge, mirrored, so 5 is the middle column.
  const cell = (y: number, hx: number): boolean => {
    switch (y) {
      case 0: // antennae
        return hx === 2 || (hx >= 3 && hx !== 5 && on(hx));
      case 1: // crown
        return hx >= 2 && (hx !== 2 || on(10));
      case 3: // eye row: eyes in column 3, cheeks random
        if (hx === 3) return false;
        return hx >= 2 || on(y * HALF + hx);
      case 2:
      case 4: // solid face, random shoulders
        return hx >= 2 || on(y * HALF + hx);
      case 5: // base of the body, always joined up
        return on(20) ? hx >= 1 : hx >= 2;
      case 6: // arms or knees
        return (on(21) ? hx === 0 || hx === 2 : hx === 1 || hx === 3) || (hx === 5 && on(22));
      default: // feet
        if (on(23)) return on(21) ? hx === 1 : hx === 0 || hx === 2;
        return on(24) ? hx === 3 || hx === 4 : hx === 0;
    }
  };
  const cells = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => cell(y, x < HALF ? x : W - 1 - x))
  );
  const amber = bytes[bytes.length - 1] % 3 === 0;
  return { cells, color: amber ? AMBER : LICHEN, amber };
}
