/**
 * Share your points on X with one of the gateway's alien cards (the picker
 * is `@/shared/ui/share-cards`). The post links to `/s/<token>`, a page that
 * only carries the card as its link preview and then sends visitors on to
 * /points. The gateway draws the cards from the wallet's live points; the
 * token hides the address.
 */
import posthog from 'posthog-js';
import { landingHref } from '@/shared/lib/domains';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { ShareCards, type ShareOption } from '@/shared/ui/share-cards';
import { createShareTokens, shareCardUrl, type PointsAccount } from '../../api/pointsClient';
import { points, topShare } from '../../model/format';

const OPTIONS: ShareOption[] = [{ id: 'hide_address', label: 'Hide my address' }];

const absolute = (href: string) =>
  href.startsWith('http') ? href : `${window.location.origin}${href}`;

function PointsShareCards({ wallet, account }: { wallet: string; account: PointsAccount }) {
  const standing =
    account.rank !== null
      ? `, ranked #${account.rank.toLocaleString()} of ${account.ranked.toLocaleString()} (top ${topShare(account.rank, account.ranked)})`
      : '';
  return (
    <ShareCards
      load={(o, signal) => createShareTokens(wallet, o.hide_address, signal)}
      cardUrl={shareCardUrl}
      // The card's own link, whose preview is the card. Without one (the
      // gateway is down), the post still links to the points page.
      linkUrl={token => absolute(landingHref(token ? `/s/${token}` : '/points'))}
      text={`I've got ${points(account.total)} ALIEN Points on @FermiTrade${standing}. Check yours:`}
      options={OPTIONS}
      fileName="fermi-alien-points.png"
      alt="Your ALIEN points card"
      failedText="Couldn't load the cards. You can still post a link to the points page."
      onShare={(via, card, o) =>
        posthog.capture(via === 'x' ? 'points_share_x' : 'points_share_copy', {
          card,
          hide_address: o.hide_address,
        })
      }
    />
  );
}

export function ShareCardDialog({
  open,
  onOpenChange,
  wallet,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: string;
  account: PointsAccount;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl gap-5 overflow-y-auto p-5 md:p-6">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-light">Share your points</DialogTitle>
          <DialogDescription className="text-sm">
            Pick a card. Your post shows it as the link preview, and the link never shows your
            address.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the cards load when they're needed. */}
        <PointsShareCards wallet={wallet} account={account} />
      </DialogContent>
    </Dialog>
  );
}
