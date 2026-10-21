/**
 * domains.ts
 * One build serves both domains: fermi.trade shows only the landing pages and
 * app.fermi.trade only the trading app. Other hosts (staging, previews,
 * localhost) serve everything, so links between the two halves must stay on
 * the current host there instead of jumping to production.
 */

export const APP_ORIGIN = 'https://app.fermi.trade';
export const LANDING_ORIGIN = 'https://fermi.trade';

const LANDING_HOSTS = ['fermi.trade', 'www.fermi.trade'];
const APP_HOSTS = ['app.fermi.trade'];

const host = typeof window !== 'undefined' ? window.location.hostname : '';

export const isLandingHost = LANDING_HOSTS.includes(host);
export const isAppHost = APP_HOSTS.includes(host);

/** Hosts that show pages we haven't launched yet. Production hides them. */
const PREVIEW_HOSTS = ['staging.fermi.trade', 'localhost', '127.0.0.1'];

/**
 * Vaults and FLP aren't live on mainnet yet: only staging and local dev route
 * to them or link to them. Any other host, production included, hides them.
 * (Points launched on 2026-10-21 and are shown everywhere.)
 */
export const showUnlaunched = PREVIEW_HOSTS.includes(host);

/**
 * A link to an app route (`/perps`, `/vaults`, …): on the landing domain it
 * points at app.fermi.trade, everywhere else it stays on the current host.
 */
export function appHref(path: string): string {
  return isLandingHost ? `${APP_ORIGIN}${path}` : path;
}

/**
 * A link to a landing route (`/points`, …): on the app domain it points at
 * fermi.trade, everywhere else it stays on the current host.
 */
export function landingHref(path: string): string {
  return isAppHost ? `${LANDING_ORIGIN}${path}` : path;
}
