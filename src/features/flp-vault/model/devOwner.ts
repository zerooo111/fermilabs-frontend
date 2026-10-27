/**
 * Dev builds only: `?flpOwner=<wallet>` shows that wallet's FLP position,
 * requests and form limits read-only, without signing in. Wallet login needs
 * VITE_PRIVY_APP_ID, which local dev doesn't have, so this is how people and
 * agents check the connected views. Signing stays disabled.
 */
import { PublicKey } from '@solana/web3.js';

export function devOwner(): string | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('flpOwner');
  if (!raw) return null;
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    return null;
  }
}
