/**
 * Display + share helpers for the referral programme UI.
 *
 * Money is always read from the backend's `*_usdc` convenience views — we never
 * do lots→USDC math client-side. Codes are case-insensitive but always shown /
 * shared upper-case so legacy lower-case codes render consistently.
 */
import { toast } from 'sonner';

export function usd(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '$0.00';
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function shortWallet(w: string): string {
  return w.length > 12 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w;
}

export function shareLink(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.fermi.trade';
  return `${origin}/referrals?ref=${encodeURIComponent(code)}`;
}

/** A pre-filled X/Twitter intent URL for sharing a referral code. */
export function tweetIntent(code: string): string {
  const text = `Trading on Fermi — use my referral code ${code} and we both earn on every trade.`;
  const url = shareLink(code);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export async function copy(text: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard.`);
    return true;
  } catch {
    toast.error('Could not copy to clipboard.');
    return false;
  }
}
