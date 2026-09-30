import { LINKS } from '../constants';
import {
  ContinuumDrawing,
  FifoPerpsDrawing,
  MarketShareDrawing,
  ProofOfSequenceDrawing,
  RoadmapDrawing,
} from './illustrations';

// Newest first; the first post is featured across the full width
const BLOG_POSTS = [
  {
    title: 'Fermi v1: Designing a FIFO perps exchange on Solana',
    description:
      'How Fermi matches perpetuals first in, first out, and settles only executed trades onchain.',
    date: 'Apr 14, 2026',
    url: 'https://seldonfromfermi.substack.com/p/fermi-v1-designing-a-fifo-perps-exchange',
    Drawing: FifoPerpsDrawing,
  },
  {
    title: 'Verifiable ordering on Blockchains: Proof of Sequence (PoSq)',
    description:
      "The core internal timekeeping mechanism behind Continuum Chain's FIFO guarantees.",
    date: 'Mar 8, 2026',
    url: 'https://seldonfromfermi.substack.com/p/verifiable-ordering-on-blockchains',
    Drawing: ProofOfSequenceDrawing,
  },
  {
    title: 'Continuum: The Blockchain for Trading',
    description: 'TradFi meets DeFi.',
    date: 'Mar 8, 2026',
    url: 'https://seldonfromfermi.substack.com/p/continuum-the-blockchain-for-trading',
    Drawing: ContinuumDrawing,
  },
  {
    title: 'The Market Structure Wars',
    description: "What's the ideal way to match orders and execute trades?",
    date: 'Feb 19, 2026',
    url: 'https://seldonfromfermi.substack.com/p/the-market-structure-wars',
    Drawing: MarketShareDrawing,
  },
  {
    title: 'The Blockchain Capital Markets Roadmap',
    description:
      'How blockchains will achieve NASDAQ-like market microstructure without trusted intermediaries.',
    date: 'Feb 3, 2026',
    url: 'https://seldonfromfermi.substack.com/p/the-blockchain-capital-markets-roadmap',
    Drawing: RoadmapDrawing,
  },
];

function Arrow() {
  return (
    <svg
      className="card-arrow size-12 shrink-0 md:size-16"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M13 35 35 13M17 13h18v18" />
    </svg>
  );
}

export default function BlogSection() {
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <>
      <section className="w-full border-b border-rock/15">
        <div className="frame reg flex flex-col gap-4 px-5 py-8 sm:flex-row sm:items-end sm:justify-between md:px-10 md:py-10">
          <h2 className="font-serif text-4xl leading-none font-light tracking-[-0.02em] md:text-5xl">
            From the blog
          </h2>
          <a
            href={LINKS.BLOG}
            target="_blank"
            rel="noreferrer"
            className="link self-start sm:self-auto"
          >
            Browse all articles
          </a>
        </div>
      </section>
      <section className="w-full border-b border-rock/15">
        <div className="frame grid gap-px bg-rock/15 sm:grid-cols-2">
          <a
            href={featured.url}
            target="_blank"
            rel="noreferrer"
            className="dither-corner group grid gap-6 bg-dark-forest px-5 py-8 sm:col-span-2 md:grid-cols-2 md:gap-10 md:px-10 md:py-10"
          >
            <featured.Drawing />
            <div className="flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-3">
                <span className="text-sm text-rock/55">Latest · {featured.date}</span>
                <h3 className="font-serif text-3xl tracking-[-0.015em] group-hover:text-amber-100 md:text-4xl">
                  {featured.title}
                </h3>
                <p className="max-w-md text-rock/60">{featured.description}</p>
              </div>
              <Arrow />
            </div>
          </a>
          {rest.map(({ title, description, date, url, Drawing }) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="dither-corner group flex flex-col gap-6 bg-dark-forest px-5 py-8 md:px-10 md:py-10"
            >
              <Drawing />
              <div className="flex items-center justify-between gap-6">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm text-rock/55">{date}</span>
                  <h3 className="font-serif text-2xl tracking-[-0.01em] group-hover:text-amber-100 md:text-3xl">
                    {title}
                  </h3>
                  <p className="text-rock/60">{description}</p>
                </div>
                <Arrow />
              </div>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
