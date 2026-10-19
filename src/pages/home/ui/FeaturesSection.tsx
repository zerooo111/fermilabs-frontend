import {
  FairQueueDrawing,
  FinalityDrawing,
  LiquidityDrawing,
  SequencingDrawing,
} from './illustrations';

const FEATURES = [
  {
    title: "Crypto's fairest orderbook",
    body: 'No mempool, no MEV games, no one cutting the line. Orders fill in strict price-time priority.',
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
  return (
    <>
      <section className="w-full">
        <div className="frame border-b border-rock/15 reg flex flex-col gap-4 px-5 py-8 sm:flex-row sm:items-end sm:justify-between md:px-10 md:py-10">
          <h2 className="font-serif text-4xl leading-none font-light tracking-[-0.02em] md:text-5xl">
            Why trade on Fermi
          </h2>
        </div>
      </section>
      <section className="w-full">
        <div className="frame border-b border-rock/15 sheet-grid grid sm:grid-cols-2">
          {FEATURES.map(({ title, body, Drawing, link }, i) => (
            <article
              key={title}
              data-col={i % 2 === 0 ? 'left' : 'right'}
              data-row={i >= FEATURES.length - 2 ? 'last' : undefined}
              className="sheet-card flex flex-col gap-6 bg-background px-5 py-8 md:px-10 md:py-10"
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
