/**
 * Share an open position's PnL on X with one of the gateway's alien cards
 * (the picker is `@/shared/ui/share-cards`). The post links to `/t/<token>`,
 * a page that only carries the card as its link preview and then sends
 * visitors on to the app.
 */
import { useState } from 'react';
import posthog from 'posthog-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { ShareCards, type ShareOption } from '@/shared/ui/share-cards';
import { createPnlShare, pnlCardUrl, type SharedPosition } from '../api/pnlShareClient';

const OPTIONS: ShareOption[] = [
  { id: 'hide_pnl', label: 'Hide PnL amount' },
  { id: 'hide_address', label: 'Hide my address' },
];

const pct = (v: number) => `${Math.abs(v).toFixed(2)}%`;

/** The post's text, from the position as the gateway sealed it. */
function postText(p: SharedPosition | null, marketName: string, side: 'long' | 'short'): string {
  const trade = `my ${p?.market_name ?? marketName} ${p?.side ?? side}`;
  if (!p) return `Trading ${trade} on @FermiTrade`;
  return `${p.return_pct >= 0 ? 'Up' : 'Down'} ${pct(p.return_pct)} on ${trade} on @FermiTrade`;
}

function PnlShareCards({
  wallet,
  market,
  marketName,
  side,
}: {
  wallet: string;
  market: number;
  marketName: string;
  side: 'long' | 'short';
}) {
  const [shared, setShared] = useState<SharedPosition | null>(null);
  return (
    <ShareCards
      load={async (o, signal) => {
        const share = await createPnlShare(
          wallet,
          market,
          { hideAddress: o.hide_address, hidePnl: o.hide_pnl },
          signal
        );
        if (!signal.aborted) setShared(share.position);
        return share.tokens;
      }}
      cardUrl={pnlCardUrl}
      linkUrl={token => `${window.location.origin}${token ? `/t/${token}` : '/perps'}`}
      text={postText(shared, marketName, side)}
      options={OPTIONS}
      fileName={`fermi-${marketName.toLowerCase()}-${side}.png`}
      alt={`Your ${marketName} ${side} PnL card`}
      failedText="Couldn't load the cards. You can still post a link to Fermi Trade."
      onShare={(via, card, o) =>
        posthog.capture(via === 'x' ? 'pnl_share_x' : 'pnl_share_copy', {
          card,
          market,
          side,
          hide_address: o.hide_address,
          hide_pnl: o.hide_pnl,
        })
      }
    />
  );
}

export function PnlShareDialog({
  open,
  onOpenChange,
  wallet,
  market,
  marketName,
  side,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: string;
  market: number;
  marketName: string;
  side: 'long' | 'short';
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl gap-5 overflow-y-auto p-5 md:p-6">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-light">
            Share your {marketName} {side}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Pick a card. It shows the position as it is right now, and the link never shows your
            address.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the cards load (and snapshot the position) when asked. */}
        <PnlShareCards wallet={wallet} market={market} marketName={marketName} side={side} />
      </DialogContent>
    </Dialog>
  );
}
