/**
 * Loading and handling the gateway's share cards (points and PnL): a token
 * and a PNG per card style, fetched together, plus copy and download. The
 * dialogs that use them are `@/shared/ui/share-cards` (points) and the PnL
 * share dialog.
 */
import { useEffect, useRef, useState } from 'react';

/** The card styles, in the order the gateway draws them. */
export type ShareCardStyle = 'abduction' | 'specimen' | 'homeworld' | 'print';

export const CARDS: { id: ShareCardStyle; name: string }[] = [
  { id: 'abduction', name: 'Abduction' },
  { id: 'specimen', name: 'Specimen' },
  { id: 'homeworld', name: 'Homeworld' },
  { id: 'print', name: 'Field print' },
];

export type LoadShareTokens = (
  options: Record<string, boolean>,
  signal: AbortSignal
) => Promise<Record<ShareCardStyle, string>>;

export type ShareCard = { token: string; blob: Blob; url: string };
export type ShareCardSet = Record<ShareCardStyle, ShareCard>;

const revoke = (cards: ShareCardSet | null) =>
  Object.values(cards ?? {}).forEach(c => URL.revokeObjectURL(c.url));

/**
 * Every card for the options picked, with its share token, fetched as PNGs so
 * they can be copied and downloaded. The last set stays up while the next loads.
 */
export function useShareCards(
  load: LoadShareTokens,
  cardUrl: (token: string) => string,
  options: Record<string, boolean>
): { cards: ShareCardSet | null; loading: boolean; failed: boolean } {
  const [cards, setCards] = useState<ShareCardSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const latest = useRef(cards);
  latest.current = cards;
  // Callers pass fresh functions each render; only the options refetch.
  const fns = useRef({ load, cardUrl });
  fns.current = { load, cardUrl };
  const key = JSON.stringify(options);

  useEffect(() => {
    const abort = new AbortController();
    const { signal } = abort;
    setFailed(false);
    setLoading(true);
    fns.current
      .load(JSON.parse(key) as Record<string, boolean>, signal)
      .then(tokens =>
        Promise.all(
          CARDS.map(async c => {
            const res = await fetch(fns.current.cardUrl(tokens[c.id]), { signal });
            if (!res.ok) throw new Error(`card ${c.id}: ${res.status}`);
            const blob = await res.blob();
            return [c.id, { token: tokens[c.id], blob, url: URL.createObjectURL(blob) }] as const;
          })
        )
      )
      .then(entries => {
        const next = Object.fromEntries(entries) as ShareCardSet;
        if (signal.aborted) return revoke(next);
        revoke(latest.current);
        setCards(next);
        setLoading(false);
      })
      .catch(error => {
        if (signal.aborted) return;
        console.error('Failed to load share cards:', error);
        setFailed(true);
        setLoading(false);
      });
    return () => abort.abort();
  }, [key]);

  useEffect(() => () => revoke(latest.current), []);
  return { cards, loading, failed };
}

export async function copyImage(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

export function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

/** Some browsers (older Firefox, in-app webviews) can't put an image on the clipboard. */
export const CAN_COPY_IMAGE = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
