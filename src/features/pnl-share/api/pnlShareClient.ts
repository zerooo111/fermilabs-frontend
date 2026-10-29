/**
 * REST client for /v2/pnl/share: share cards for an open position. Making a
 * link has the gateway read the position and the market's mark price and
 * seal them into the token, so the card shows the trade as it was shared.
 */
import axios from 'axios';
import { API_ROUTES_V2, config } from '@/shared/config/constants';
import type { ShareCardStyle } from '@/shared/ui/share-cards';

/** The position as the cards show it, in UI units. */
export type SharedPosition = {
  market: number;
  market_name: string;
  side: 'long' | 'short';
  entry: number;
  mark: number;
  size: number;
  /** The price move on the entry, signed by side, in percent. */
  return_pct: number;
  pnl: number;
  at_ms: number;
};

export type PnlShare = { tokens: Record<ShareCardStyle, string>; position: SharedPosition };

const baseUrl = (): string => config.devnet.gatewayUrl;

export async function createPnlShare(
  wallet: string,
  market: number,
  options: { hideAddress: boolean; hidePnl: boolean },
  signal?: AbortSignal
): Promise<PnlShare> {
  const res = await axios.post<PnlShare>(
    `${baseUrl()}${API_ROUTES_V2.pnl_share}`,
    { wallet, market, hide_address: options.hideAddress, hide_pnl: options.hidePnl },
    { signal }
  );
  return res.data;
}

/** A PnL card as a PNG; every number on it comes from the token. */
export function pnlCardUrl(token: string): string {
  return `${baseUrl()}${API_ROUTES_V2.pnl_share_card.replace('{token}', token)}`;
}
