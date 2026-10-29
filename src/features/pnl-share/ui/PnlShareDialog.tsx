/**
 * Share an open position: one of the gateway's alien cards with the trade on
 * it, a short link whose X preview is the card (`/t/<id>`, answered by
 * functions/t), and ways to post it, copy it, save it or hand it to the
 * phone's share sheet. The cards load with `useShareCards` from
 * `@/shared/lib/share-cards`, like the points dialog's.
 */
import { useState } from 'react';
import { Check, Copy, Download, Link2, Loader2, Share } from 'lucide-react';
import { XLogo } from '@phosphor-icons/react';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  CAN_COPY_IMAGE,
  CARDS,
  copyImage,
  download,
  useShareCards,
  type ShareCardStyle,
} from '@/shared/lib/share-cards';
import {
  createPnlShare,
  pnlCardUrl,
  type ShareablePosition,
  type SharedPosition,
} from '../api/pnlShareClient';

/** The move on the entry, signed by side, as the gateway works it out. */
const returnPct = (p: ShareablePosition) =>
  p.entry > 0 ? ((p.mark - p.entry) / p.entry) * 100 * (p.side === 'long' ? 1 : -1) : 0;

const signed = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}%`;

/** The post's text, from the position as the gateway drew it. */
function postText(shared: SharedPosition | null, position: ShareablePosition): string {
  const trade = `my ${position.marketName} ${position.side}`;
  if (!shared) return `Trading ${trade} on @FermiTrade`;
  const pct = Math.abs(shared.return_pct).toFixed(2);
  return `${shared.return_pct >= 0 ? 'Up' : 'Down'} ${pct}% on ${trade} on @FermiTrade`;
}

/**
 * The phone's share sheet, where it can take an image. Desktops that have
 * one (Chrome on macOS) get Copy image instead, which is what they'd use.
 */
function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  if (!window.matchMedia?.('(pointer: coarse)').matches) return false;
  try {
    return navigator.canShare({ files: [new File([], 'card.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}
const CAN_SHARE_FILES = canShareFiles();

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-rock/80 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="size-3.5 accent-amber-200"
      />
      {children}
    </label>
  );
}

function PnlShare({ wallet, position }: { wallet: string; position: ShareablePosition }) {
  const { market, marketName, side } = position;
  const [style, setStyle] = useState<ShareCardStyle>(CARDS[0].id);
  const [showPnl, setShowPnl] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [shared, setShared] = useState<SharedPosition | null>(null);
  const [copied, setCopied] = useState<'link' | 'image' | null>(null);

  const { cards, loading, failed } = useShareCards(
    async (o, signal) => {
      const share = await createPnlShare(
        wallet,
        position,
        { hideAddress: o.hide_address, hidePnl: o.hide_pnl },
        signal
      );
      if (!signal.aborted) setShared(share.position);
      return share.tokens;
    },
    pnlCardUrl,
    { hide_pnl: !showPnl, hide_address: !showAddress }
  );
  const card = cards?.[style];
  // The card's own link, whose preview is the card; the app without one.
  const link = `${window.location.origin}${card ? `/t/${card.token}` : '/perps'}`;
  const text = postText(shared, position);

  const track = (via: string) =>
    posthog.capture(`pnl_share_${via}`, {
      card: style,
      market,
      side,
      hide_address: !showAddress,
      hide_pnl: !showPnl,
    });

  const flash = (what: 'link' | 'image') => {
    setCopied(what);
    window.setTimeout(() => setCopied(current => (current === what ? null : current)), 1500);
  };

  const post = () => {
    track('x');
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    const tab = window.open(intent, '_blank');
    if (tab) tab.opener = null;
  };

  const copyLink = async () => {
    if (!card) return;
    track('link');
    try {
      await navigator.clipboard.writeText(link);
      flash('link');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  const copyCard = async () => {
    if (!card) return;
    track('copy');
    if (await copyImage(card.blob)) flash('image');
    else toast.error('Could not copy the image. Use Download instead.');
  };

  const fileName = `fermi-${marketName.toLowerCase()}-${side}.png`;
  const shareSheet = async () => {
    if (!card) return;
    track('native');
    const file = new File([card.blob], fileName, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], text: `${text} ${link}` });
    } catch {
      /* dismissed */
    }
  };

  return (
    // min-w-0: the dialog is a grid, and the full-size card images would
    // otherwise widen it past a phone's screen.
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative aspect-[1200/630] w-full overflow-hidden border border-outline bg-rock/5">
        {card ? (
          <img
            src={card.url}
            alt={`Your ${marketName} ${side} PnL card`}
            className={cn(
              'block size-full transition-opacity duration-150',
              loading && 'opacity-60'
            )}
            draggable={false}
          />
        ) : failed ? (
          <p className="flex size-full items-center justify-center p-6 text-center text-sm text-rock/60">
            Couldn&apos;t load the cards. You can still post a link to Fermi Trade.
          </p>
        ) : (
          <span aria-hidden className="block size-full animate-pulse bg-rock/10" />
        )}
        {loading && (
          <Loader2
            className="absolute right-3 top-3 size-4 animate-spin text-rock/70"
            aria-hidden
          />
        )}
      </div>

      <div role="radiogroup" aria-label="Card style" className="grid grid-cols-4 gap-2">
        {CARDS.map(c => {
          const selected = c.id === style;
          const thumb = cards?.[c.id];
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setStyle(c.id)}
              className={cn(
                'flex min-w-0 flex-col gap-1 border p-1 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200',
                selected ? 'border-amber-200' : 'border-outline hover:border-rock/40'
              )}
            >
              <span className="block aspect-[1200/630] w-full overflow-hidden bg-rock/5">
                {thumb ? (
                  <img src={thumb.url} alt="" className="block size-full" draggable={false} />
                ) : (
                  <span aria-hidden className="block size-full animate-pulse bg-rock/10" />
                )}
              </span>
              <span
                className={cn(
                  'truncate px-0.5 text-[11px]',
                  selected ? 'text-rock' : 'text-rock/60'
                )}
              >
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Toggle checked={showPnl} onChange={setShowPnl}>
          Show PnL amount
        </Toggle>
        <Toggle checked={showAddress} onChange={setShowAddress}>
          Show address
        </Toggle>
      </div>

      {/* The short link, ready to paste anywhere */}
      <div className="flex h-9 items-center border border-outline">
        <Link2 className="ml-3 size-3.5 shrink-0 text-rock/50" aria-hidden />
        <span className="min-w-0 flex-1 truncate px-2 font-mono text-xs text-rock/80">
          {card ? link.replace(/^https?:\/\//, '') : 'Making your link…'}
        </span>
        <button
          type="button"
          onClick={() => void copyLink()}
          disabled={!card}
          className="flex h-full items-center gap-1.5 border-l border-outline px-3 text-xs text-rock/80 transition-colors hover:bg-rock/5 hover:text-rock disabled:opacity-50"
        >
          {copied === 'link' ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            variant="outline"
            disabled={!card}
            onClick={() => {
              if (!card) return;
              track('download');
              download(card.url, fileName);
            }}
          >
            <Download aria-hidden />
            Download
          </Button>
          {CAN_SHARE_FILES ? (
            <Button variant="outline" disabled={!card} onClick={() => void shareSheet()}>
              <Share aria-hidden />
              Share…
            </Button>
          ) : (
            CAN_COPY_IMAGE && (
              <Button variant="outline" disabled={!card} onClick={() => void copyCard()}>
                {copied === 'image' ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied === 'image' ? 'Copied' : 'Copy image'}
              </Button>
            )
          )}
        </div>
        <Button disabled={!card && !failed} onClick={post}>
          <XLogo weight="bold" aria-hidden />
          Post on X
        </Button>
      </div>
    </div>
  );
}

export function PnlShareDialog({
  open,
  onOpenChange,
  wallet,
  position,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: string;
  /** Taken when Share was clicked, so the cards don't move with the mark. */
  position: ShareablePosition;
}) {
  const pct = returnPct(position);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto outline-none"
        // Focus the dialog itself, not the first card style.
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <DialogHeader className="gap-2 pr-6">
          <DialogTitle>Share position</DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={position.side === 'long' ? 'success' : 'danger'}>
                {position.side === 'long' ? 'Long' : 'Short'}
              </Badge>
              <span className="text-rock">{position.marketName}</span>
              <span
                className={cn('font-mono tabular-nums', pct < 0 ? 'text-danger' : 'text-success')}
              >
                {signed(pct)}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the cards load when they're needed. */}
        <PnlShare wallet={wallet} position={position} />
      </DialogContent>
    </Dialog>
  );
}
