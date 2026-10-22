/**
 * Share on X with a card: pick one of the alien cards, hide the address if
 * you like, then post. X's tweet link can't carry an image, so the post links
 * to `/s/<token>` instead: a page that only carries the card as its link
 * preview and then sends visitors on to /points. The gateway draws the cards
 * from the wallet's live points; the token hides the address. Copy and
 * Download are there for anyone who'd rather attach the image itself.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { XLogo } from '@phosphor-icons/react';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { landingHref } from '@/shared/lib/domains';
import { cn } from '@/shared/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  createShareTokens,
  shareCardUrl,
  type PointsAccount,
  type ShareCardStyle,
} from '../../api/pointsClient';
import { points, topShare } from '../../model/format';
import { Bone } from '../primitives';

const CARDS: { id: ShareCardStyle; name: string }[] = [
  { id: 'abduction', name: 'Abduction' },
  { id: 'specimen', name: 'Specimen' },
  { id: 'homeworld', name: 'Homeworld' },
  { id: 'print', name: 'Field print' },
];

type Card = { token: string; blob: Blob; url: string };
type Cards = Record<ShareCardStyle, Card>;

const revoke = (cards: Cards | null) =>
  Object.values(cards ?? {}).forEach(c => URL.revokeObjectURL(c.url));

/**
 * Every card for the wallet, with its share token, fetched as PNGs so they
 * can be copied and downloaded. The last set stays up while the next loads.
 */
function useCards(wallet: string, hideAddress: boolean): { cards: Cards | null; failed: boolean } {
  const [cards, setCards] = useState<Cards | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef(cards);
  latest.current = cards;

  useEffect(() => {
    const abort = new AbortController();
    const { signal } = abort;
    setFailed(false);
    createShareTokens(wallet, hideAddress, signal)
      .then(tokens =>
        Promise.all(
          CARDS.map(async c => {
            const res = await fetch(shareCardUrl(tokens[c.id]), { signal });
            if (!res.ok) throw new Error(`card ${c.id}: ${res.status}`);
            const blob = await res.blob();
            return [c.id, { token: tokens[c.id], blob, url: URL.createObjectURL(blob) }] as const;
          })
        )
      )
      .then(entries => {
        const next = Object.fromEntries(entries) as Cards;
        if (signal.aborted) return revoke(next);
        revoke(latest.current);
        setCards(next);
      })
      .catch(error => {
        if (signal.aborted) return;
        console.error('Failed to load share cards:', error);
        setFailed(true);
      });
    return () => abort.abort();
  }, [wallet, hideAddress]);

  useEffect(() => () => revoke(latest.current), []);
  return { cards, failed };
}

async function copyImage(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

const FILE_NAME = 'fermi-alien-points.png';
/** Some browsers (older Firefox, in-app webviews) can't put an image on the clipboard. */
const CAN_COPY_IMAGE = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

const CTA =
  'inline-flex items-center justify-center gap-2 bg-amber-200 px-5 py-2.5 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100 disabled:opacity-50';
const CTA_SECONDARY =
  'inline-flex items-center justify-center gap-2 border border-rock/25 px-5 py-2.5 font-medium text-rock transition-colors duration-150 hover:border-rock/50 hover:bg-rock/5 disabled:opacity-50';

function ShareCards({ wallet, account }: { wallet: string; account: PointsAccount }) {
  const [cardId, setCardId] = useState<ShareCardStyle>(CARDS[0].id);
  const [hideAddress, setHideAddress] = useState(false);
  const { cards, failed } = useCards(wallet, hideAddress);
  const card = cards?.[cardId];
  const [copied, setCopied] = useState(false);

  // The card's own link, whose preview is the card. Without one (the gateway
  // is down), the post still links to the points page.
  const href = landingHref(card ? `/s/${card.token}` : '/points');
  const url = href.startsWith('http') ? href : `${window.location.origin}${href}`;
  const standing =
    account.rank !== null
      ? `, ranked #${account.rank.toLocaleString()} of ${account.ranked.toLocaleString()} (top ${topShare(account.rank, account.ranked)})`
      : '';
  const text = `I've got ${points(account.total)} ALIEN Points on @FermiTrade${standing}. Check yours:`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  const post = () => {
    posthog.capture('points_share_x', { card: cardId, hide_address: hideAddress });
    const tab = window.open(intent, '_blank');
    if (tab) tab.opener = null;
  };

  const copy = async () => {
    if (!card) return;
    posthog.capture('points_share_copy', { card: cardId, hide_address: hideAddress });
    if (!(await copyImage(card.blob))) {
      toast.error('Could not copy the image. Use Download instead.');
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const CopyIcon = copied ? Check : Copy;

  return (
    <>
      <div className="aspect-[1200/675] w-full border border-rock/15 bg-rock/5">
        {card ? (
          <img
            src={card.url}
            alt="Your ALIEN points card"
            className="block size-full"
            draggable={false}
          />
        ) : failed ? (
          <p className="flex size-full items-center justify-center p-6 text-center text-sm text-rock/60">
            Couldn&apos;t load the cards. You can still post a link to the points page.
          </p>
        ) : (
          <Bone className="size-full" />
        )}
      </div>

      <div role="radiogroup" aria-label="Card" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CARDS.map(c => {
          const selected = c.id === cardId;
          const thumb = cards?.[c.id];
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setCardId(c.id)}
              className={cn(
                'flex flex-col gap-1.5 border p-1.5 text-left transition-colors duration-150',
                selected ? 'border-amber-200' : 'border-rock/15 hover:border-rock/40'
              )}
            >
              <span className="block aspect-[1200/675] w-full bg-rock/5">
                {thumb ? (
                  <img src={thumb.url} alt="" className="block size-full" draggable={false} />
                ) : (
                  <Bone className="size-full" />
                )}
              </span>
              <span className={cn('px-0.5 text-xs', selected ? 'text-rock' : 'text-rock/60')}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-rock/80 select-none">
          <input
            type="checkbox"
            checked={hideAddress}
            onChange={e => setHideAddress(e.target.checked)}
            className="size-4 accent-amber-200"
          />
          Hide my address
        </label>
        {/* On phones the buttons take the full row and stretch to fill each line they wrap onto. */}
        <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>button]:grow sm:[&>button]:grow-0">
          <button
            type="button"
            disabled={!card}
            onClick={() => card && download(card.url, FILE_NAME)}
            className={CTA_SECONDARY}
          >
            <Download className="size-4" aria-hidden />
            Download
          </button>
          {CAN_COPY_IMAGE && (
            <button
              type="button"
              disabled={!card}
              onClick={() => void copy()}
              className={CTA_SECONDARY}
            >
              <CopyIcon className="size-4" aria-hidden />
              {copied ? 'Copied' : 'Copy image'}
            </button>
          )}
          <button type="button" disabled={!card && !failed} onClick={post} className={CTA}>
            <XLogo weight="bold" className="size-4" aria-hidden />
            Post on X
          </button>
        </div>
      </div>
    </>
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
        <ShareCards wallet={wallet} account={account} />
      </DialogContent>
    </Dialog>
  );
}
