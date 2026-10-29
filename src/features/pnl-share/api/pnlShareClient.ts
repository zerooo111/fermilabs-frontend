/**
 * REST client for /v2/pnl/share: share cards for an open position. The page
 * sends the numbers it shows and the gateway keeps them under a short card
 * id, so the card shows the trade as it was shared. It's a social card, not
 * proof.
 */
import axios from 'axios';
import { API_ROUTES_V2, config } from '@/shared/config/constants';
import type { ShareCardStyle } from '@/shared/lib/share-cards';

/** A position to share, in UI units, as the positions table shows it. */
export type ShareablePosition = {
  /** The market index, for analytics. */
  market: number;
  marketName: string;
  side: 'long' | 'short';
  entry: number;
  mark: number;
  /** Base units, unsigned. */
  size: number;
};

/** The position as the cards show it, in UI units. */
export type SharedPosition = {
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
  position: ShareablePosition,
  options: { hideAddress: boolean; hidePnl: boolean },
  signal?: AbortSignal
): Promise<PnlShare> {
  const res = await axios.post<PnlShare>(
    `${baseUrl()}${API_ROUTES_V2.pnl_share}`,
    {
      wallet,
      market_name: position.marketName,
      side: position.side,
      entry: position.entry,
      mark: position.mark,
      size: position.size,
      hide_address: options.hideAddress,
      hide_pnl: options.hidePnl,
    },
    { signal }
  );
  return res.data;
}

/** A PnL card as a PNG, drawn from what was shared under its id. */
export function pnlCardUrl(token: string): string {
  return `${baseUrl()}${API_ROUTES_V2.pnl_share_card.replace('{token}', token)}`;
}
