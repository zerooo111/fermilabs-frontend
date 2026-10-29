/**
 * The body of a share-on-X dialog: pick one of the gateway's alien cards,
 * set what to hide, then post. X's tweet link can't carry an image, so the
 * post links to a page that only carries the card as its link preview (a
 * Pages Function under `functions/`). Copy and Download are there for anyone
 * who'd rather attach the image itself. Points and PnL cards both use it.
 */
import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { XLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import {
  CAN_COPY_IMAGE,
  CARDS,
  copyImage,
  download,
  useShareCards,
  type LoadShareTokens,
  type ShareCardStyle,
} from '@/shared/lib/share-cards';

export type { ShareCardStyle };

/** A checkbox under the card, like "Hide my address". */
export type ShareOption = { id: string; label: string };

export type ShareCardsProps = {
  /** A token per style for the options picked; refetched when they change. */
  load: LoadShareTokens;
  cardUrl: (token: string) => string;
  /** The link the post carries: the card's own link, or a fallback without one. */
  linkUrl: (token: string | null) => string;
  /** The post's text, before the link. */
  text: string;
  options: ShareOption[];
  fileName: string;
  alt: string;
  failedText: string;
  /** Called with `x` or `copy` and the picked card and options, for analytics. */
  onShare?: (via: 'x' | 'copy', card: ShareCardStyle, options: Record<string, boolean>) => void;
};

const CTA =
  'inline-flex items-center justify-center gap-2 bg-amber-200 px-5 py-2.5 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100 disabled:opacity-50';
const CTA_SECONDARY =
  'inline-flex items-center justify-center gap-2 border border-rock/25 px-5 py-2.5 font-medium text-rock transition-colors duration-150 hover:border-rock/50 hover:bg-rock/5 disabled:opacity-50';

function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse bg-rock/10', className)} />;
}

export function ShareCards({
  load,
  cardUrl,
  linkUrl,
  text,
  options: optionList,
  fileName,
  alt,
  failedText,
  onShare,
}: ShareCardsProps) {
  const [cardId, setCardId] = useState<ShareCardStyle>(CARDS[0].id);
  const [options, setOptions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(optionList.map(o => [o.id, false]))
  );
  const { cards, failed } = useShareCards(load, cardUrl, options);
  const card = cards?.[cardId];
  const [copied, setCopied] = useState(false);

  const url = linkUrl(card?.token ?? null);
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  const post = () => {
    onShare?.('x', cardId, options);
    const tab = window.open(intent, '_blank');
    if (tab) tab.opener = null;
  };

  const copy = async () => {
    if (!card) return;
    onShare?.('copy', cardId, options);
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
      <div className="aspect-[1200/630] w-full border border-rock/15 bg-rock/5">
        {card ? (
          <img src={card.url} alt={alt} className="block size-full" draggable={false} />
        ) : failed ? (
          <p className="flex size-full items-center justify-center p-6 text-center text-sm text-rock/60">
            {failedText}
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
              <span className="block aspect-[1200/630] w-full bg-rock/5">
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
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {optionList.map(o => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2.5 text-sm text-rock/80 select-none"
            >
              <input
                type="checkbox"
                checked={options[o.id] ?? false}
                onChange={e => setOptions(current => ({ ...current, [o.id]: e.target.checked }))}
                className="size-4 accent-amber-200"
              />
              {o.label}
            </label>
          ))}
        </div>
        {/* On phones the buttons take the full row and stretch to fill each line they wrap onto. */}
        <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>button]:grow sm:[&>button]:grow-0">
          <button
            type="button"
            disabled={!card}
            onClick={() => card && download(card.url, fileName)}
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
