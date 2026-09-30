/**
 * domains.ts
 * One build serves both domains: fermi.trade shows only the landing page and
 * app.fermi.trade only the trading app. vercel.json does the same redirects
 * at the edge; this is the fallback for any host that doesn't run them.
 * Other hosts (localhost, previews) serve everything.
 */

export const APP_ORIGIN = 'https://app.fermi.trade';

const LANDING_HOSTS = ['fermi.trade', 'www.fermi.trade'];
const APP_HOSTS = ['app.fermi.trade'];

const host = typeof window !== 'undefined' ? window.location.hostname : '';

export const isLandingHost = LANDING_HOSTS.includes(host);
export const isAppHost = APP_HOSTS.includes(host);

/** On the landing domain, anything but `/` belongs to the app. */
export function redirectOffLanding(): boolean {
  if (!isLandingHost) return false;
  const { pathname, search, hash } = window.location;
  if (pathname === '/') return false;
  window.location.replace(`${APP_ORIGIN}${pathname}${search}${hash}`);
  return true;
}
