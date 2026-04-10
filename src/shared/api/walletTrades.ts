import { config } from '@/shared/config/constants';
import type { SSETrade } from './sse-types';

export interface FetchWalletTradesParams {
  market?: string;
  limit?: number;
  before?: number;
  signal?: AbortSignal;
}

export async function fetchWalletTrades(
  pubkey: string,
  { market, limit = 50, before, signal }: FetchWalletTradesParams = {}
): Promise<SSETrade[]> {
  const params = new URLSearchParams();
  if (market) params.set('market', market);
  if (limit) params.set('limit', String(limit));
  if (before !== undefined) params.set('before', String(before));
  const qs = params.toString();
  const url = `${config.devnet.gatewayUrl}/wallet/${pubkey}/trades${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    let message = `Failed to fetch wallet trades (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore json parse error */
    }
    throw new Error(message);
  }

  const data = (await res.json()) as SSETrade[];
  return Array.isArray(data) ? data : [];
}
