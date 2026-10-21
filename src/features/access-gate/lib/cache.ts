/**
 * localStorage cache for "is this wallet whitelisted + valid session token".
 *
 * The cache is *advisory* — the backend gate is the source of truth. If the
 * cache says yes but the server says no (token expired, wallet removed),
 * write requests fail closed and we fall back to the modal. The cache only
 * exists so we don't show the invite modal to returning users while the
 * /v1/access/status call is in flight.
 */

/**
 * `access` holds whitelisted sessions (trading). `points` holds sessions that
 * only open points claims, for wallets without access; kept apart so one never
 * reads as the other.
 */
export type SessionScope = 'access' | 'points';

const PREFIX: Record<SessionScope, string> = { access: 'fermi.wl.', points: 'fermi.pts.' };

export interface CachedSession {
  /** base58 wallet pubkey */
  wallet: string;
  /** HMAC session token from /v1/access/redeem|session */
  token: string;
  /** unix seconds when the token expires */
  expiresAt: number;
  /** unix ms when this entry was written (for cache age display) */
  cachedAt: number;
}

function key(wallet: string, scope: SessionScope): string {
  return `${PREFIX[scope]}${wallet}`;
}

export function readSession(wallet: string, scope: SessionScope = 'access'): CachedSession | null {
  try {
    const raw = localStorage.getItem(key(wallet, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    // Sanity check + auto-evict expired tokens (5 min buffer for clock skew).
    if (
      parsed.wallet === wallet &&
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt - 5 * 60 > Math.floor(Date.now() / 1000)
    ) {
      return parsed;
    }
    localStorage.removeItem(key(wallet, scope));
    return null;
  } catch {
    return null;
  }
}

export function writeSession(s: CachedSession, scope: SessionScope = 'access'): void {
  try {
    localStorage.setItem(key(s.wallet, scope), JSON.stringify(s));
  } catch {
    // localStorage unavailable (private mode, quota) — operate in-memory only.
  }
}

/** Logs the wallet out of both scopes. */
export function clearSession(wallet: string): void {
  try {
    localStorage.removeItem(key(wallet, 'access'));
    localStorage.removeItem(key(wallet, 'points'));
  } catch {
    // ignore
  }
}
