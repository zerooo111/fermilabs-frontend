import { useEffect, useRef } from 'react';

import { prefersReducedMotion } from '../lib/dither';
import {
  FairQueueDrawing,
  FinalityDrawing,
  LiquidityDrawing,
  SequencingDrawing,
} from './illustrations';

const FEATURES = [
  {
    title: "Crypto's fairest orderbook",
    body: 'No mempool, no MEV games, no one cutting the line. Orders fill in strict price-time priority, and only executed trades settle on Solana.',
    Drawing: FairQueueDrawing,
  },
  {
    title: 'Instant finality',
    body: 'Block-based DEXes give no guarantee of when, or how, your trade is included. On Fermi it confirms the moment it lands.',
    Drawing: FinalityDrawing,
  },
  {
    title: 'Modular sequencing',
    body: 'Our Continuum layer gives any rollup or DeFi app predictable first-come, first-serve ordering.',
    Drawing: SequencingDrawing,
    link: { href: 'https://continuum.wtf', label: 'Visit Continuum' },
  },
  {
    title: "Fermi's liquidity layer",
    body: 'Apps built on Fermi share one liquidity layer for composability and capital efficiency. Integrated so far: a lending protocol, a market-making vault and the exchange.',
    Drawing: LiquidityDrawing,
  },
];

export default function FeaturesSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  // Live dithered glow behind a card on hover; the static dithered corner
  // in CSS covers touch screens and reduced motion
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import('../lib/dither-hover')
      .then(({ initDitherHover }) => {
        if (!cancelled) cleanup = initDitherHover(grid, '.dither-corner');
      })
      .catch(error => console.error('Failed to load dither hover:', error));
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <>
      <section className="w-full border-b border-rock/15">
        <div className="frame reg flex flex-col gap-4 px-5 py-8 sm:flex-row sm:items-end sm:justify-between md:px-10 md:py-10">
          <h2 className="font-serif text-4xl leading-none font-light tracking-[-0.02em] md:text-5xl">
            Why trade on Fermi
          </h2>
        </div>
      </section>
      <section className="w-full border-b border-rock/15">
        <div ref={gridRef} className="frame grid gap-px bg-rock/15 sm:grid-cols-2">
          {FEATURES.map(({ title, body, Drawing, link }) => (
            <article
              key={title}
              className="dither-corner flex flex-col gap-6 bg-dark-forest px-5 py-8 md:px-10 md:py-10"
            >
              <Drawing />
              <h3 className="font-serif text-2xl tracking-[-0.01em] md:text-3xl">{title}</h3>
              <p className="-mt-3 max-w-md text-rock/65">{body}</p>
              {link && (
                <a href={link.href} target="_blank" rel="noreferrer" className="link self-start">
                  {link.label}
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
