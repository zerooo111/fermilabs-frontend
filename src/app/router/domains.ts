/**
 * domains.ts
 * Splits the one build between fermi.trade (landing pages) and
 * app.fermi.trade (trading app). Cloudflare serves index.html for every
 * route, so the split happens here on load. Host detection lives in
 * `@/shared/lib/domains`.
 */
import { APP_ORIGIN, isLandingHost } from '@/shared/lib/domains';

export { isAppHost } from '@/shared/lib/domains';

/**
 * Paths the landing domain serves itself: the landing page, the points pages
 * and points share links (`/s/<token>`).
 */
const isLandingPath = (pathname: string) =>
  pathname === '/' ||
  pathname === '/points' ||
  pathname.startsWith('/points/') ||
  pathname.startsWith('/s/');

/** On the landing domain, anything but the landing paths belongs to the app. */
export function redirectOffLanding(): boolean {
  if (!isLandingHost) return false;
  const { pathname, search, hash } = window.location;
  if (isLandingPath(pathname)) return false;
  window.location.replace(`${APP_ORIGIN}${pathname}${search}${hash}`);
  return true;
}
