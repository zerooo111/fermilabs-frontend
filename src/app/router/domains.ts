/**
 * domains.ts
 * One build serves both domains: fermi.trade shows only the landing page and
 * app.fermi.trade only the trading app. Cloudflare serves index.html for
 * every route, so the split happens here on load. Other hosts (localhost,
 * previews) serve everything.
 */

export const APP_ORIGIN = 'https://app.fermi.trade';

const LANDING_HOSTS = ['fermi.trade', 'www.fermi.trade'];
const APP_HOSTS = ['app.fermi.trade'];

const host = typeof window !== 'undefined' ? window.location.hostname : '';

export const isLandingHost = LANDING_HOSTS.includes(host);
export const isAppHost = APP_HOSTS.includes(host);

/** Paths the landing domain serves itself: the landing page and the points pages. */
const isLandingPath = (pathname: string) =>
  pathname === '/' || pathname === '/points' || pathname.startsWith('/points/');

/** On the landing domain, anything but the landing paths belongs to the app. */
export function redirectOffLanding(): boolean {
  if (!isLandingHost) return false;
  const { pathname, search, hash } = window.location;
  if (isLandingPath(pathname)) return false;
  window.location.replace(`${APP_ORIGIN}${pathname}${search}${hash}`);
  return true;
}
