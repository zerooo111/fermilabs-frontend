/**
 * Share on X with a card: pick one of the alien cards, hide the address if
 * you like, then post. The post links to the points page, never to the
 * wallet. X's tweet link can't carry an image, so on phones the card goes
 * through the share sheet (the X app attaches it), and on desktop it's copied
 * to the clipboard to paste into the post that X opens.
 */
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
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
import type { PointsAccount } from '../../api/pointsClient';
import { points, topShare } from '../../model/format';
import { Bone } from '../primitives';
import { CARDS, renderCard, type CardData, type CardId } from './cards';

type Rendered = Record<CardId, { blob: Blob; url: string }>;

const revoke = (cards: Rendered | null) =>
  Object.values(cards ?? {}).forEach(c => URL.revokeObjectURL(c.url));

/** Every card for this data, as PNGs. The last set stays up while the next draws. */
function useCards({ wallet, total, rank, ranked, hideAddress }: CardData): Rendered | null {
  const [cards, setCards] = useState<Rendered | null>(null);
  const latest = useRef(cards);
  latest.current = cards;

  useEffect(() => {
    let cancelled = false;
    const data = { wallet, total, rank, ranked, hideAddress };
    Promise.all(CARDS.map(c => renderCard(c.id, data)))
      .then(blobs => {
        if (cancelled) return;
        revoke(latest.current);
        setCards(
          Object.fromEntries(
            CARDS.map((c, i) => [c.id, { blob: blobs[i], url: URL.createObjectURL(blobs[i]) }])
          ) as Rendered
        );
      })
      .catch(error => console.error('Failed to draw share cards:', error));
    return () => {
      cancelled = true;
    };
  }, [wallet, total, rank, ranked, hideAddress]);

  useEffect(() => () => revoke(latest.current), []);
  return cards;
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
const PASTE = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘V' : 'Ctrl+V';

const CTA =
  'inline-flex items-center gap-2 bg-amber-200 px-5 py-2.5 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100 disabled:opacity-50';
const CTA_SECONDARY =
  'inline-flex items-center gap-2 border border-rock/25 px-5 py-2.5 font-medium text-rock transition-colors duration-150 hover:border-rock/50 hover:bg-rock/5 disabled:opacity-50';

function ShareCards({ wallet, account }: { wallet: string; account: PointsAccount }) {
  const [cardId, setCardId] = useState<CardId>(CARDS[0].id);
  const [hideAddress, setHideAddress] = useState(false);
  const cards = useCards({
    wallet,
    total: account.total,
    rank: account.rank,
    ranked: account.ranked,
    hideAddress,
  });
  const card = cards?.[cardId];

  const href = landingHref('/points');
  const url = href.startsWith('http') ? href : `${window.location.origin}${href}`;
  const standing =
    account.rank !== null
      ? `, ranked #${account.rank.toLocaleString()} of ${account.ranked.toLocaleString()} (top ${topShare(account.rank, account.ranked)})`
      : '';
  const text = `I've got ${points(account.total)} ALIEN Points on @FermiTrade${standing}. Check yours:`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  const openX = () => {
    const tab = window.open(intent, '_blank');
    if (tab) tab.opener = null;
    return !!tab;
  };

  const post = async () => {
    if (!card) return;
    posthog.capture('points_share_x', { card: cardId, hide_address: hideAddress });

    // Phones: the share sheet hands the image and text to the X app together.
    const file = new File([card.blob], FILE_NAME, { type: card.blob.type });
    if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${text} ${url}` });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    // Desktop: copy the card, then open the post to paste it into.
    const copied = await copyImage(card.blob);
    if (!copied) download(card.url, FILE_NAME);
    const opened = openX();
    const message = copied
      ? `Card copied. Press ${PASTE} in your post to attach it.`
      : 'Card downloaded. Attach it to your post.';
    toast.success(message, {
      duration: 8000,
      action: opened ? undefined : { label: 'Open X', onClick: openX },
    });
  };

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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!card}
            onClick={() => card && download(card.url, FILE_NAME)}
            className={CTA_SECONDARY}
          >
            <Download className="size-4" aria-hidden />
            Download
          </button>
          <button type="button" disabled={!card} onClick={() => void post()} className={CTA}>
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
            Pick a card for your post. It links to the points page, not your wallet.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the cards draw when they're needed. */}
        <ShareCards wallet={wallet} account={account} />
      </DialogContent>
    </Dialog>
  );
}
