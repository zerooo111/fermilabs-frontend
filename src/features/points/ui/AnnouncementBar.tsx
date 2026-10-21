/**
 * The ALIEN points announcement: a slim bar above every page's header except
 * the points pages themselves, pointing to the checker and the docs. A viewer
 * can dismiss it for good (per browser). While it shows it sets
 * `--announce-h` on the root, so full-height layouts (the trading terminal)
 * shrink by its height instead of overflowing.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { landingHref } from '@/shared/lib/domains';
import { PointsIcon } from './HeaderPoints';

const DISMISSED_KEY = 'fermi.announce.alien-points';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

const LINK = 'shrink-0 underline-offset-4 transition-colors duration-150 hover:underline';

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const bar = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = bar.current;
    if (dismissed || !el) return;
    const sync = () => root.style.setProperty('--announce-h', `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--announce-h');
    };
  }, [dismissed]);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage unavailable: hide for this visit only.
    }
    setDismissed(true);
  };

  return (
    <div
      ref={bar}
      role="region"
      aria-label="Announcement"
      className="relative z-[6] flex items-center gap-3 border-b border-amber-200/20 bg-amber-200/[0.07] py-2 pr-2 pl-4 text-sm text-rock md:pl-5"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <p className="flex min-w-0 items-center gap-2">
          <PointsIcon className="size-3.5 shrink-0 text-amber-200" />
          <span>
            <span className="font-medium">ALIEN Points are here.</span>{' '}
            <span className="text-rock/70 max-sm:hidden">
              Over 200,000 Solana wallets hit by MEV already have points to claim.
            </span>
          </span>
        </p>
        <div className="flex items-center gap-4">
          <a
            href={landingHref('/points')}
            className={`${LINK} inline-flex items-center gap-0.5 font-medium text-amber-200`}
          >
            Check your points
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
          <a href={landingHref('/points/docs')} className={`${LINK} text-rock/70 hover:text-rock`}>
            Read the docs
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="grid size-7 shrink-0 place-items-center text-rock/50 transition-colors duration-150 hover:text-rock"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
