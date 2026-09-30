import TerminalDemo from './demo/TerminalDemo';

export default function ExchangeSection() {
  return (
    <>
      <section className="w-full border-b border-rock/15">
        <div className="frame reg flex flex-col gap-4 px-5 py-8 sm:flex-row sm:items-end sm:justify-between md:px-10 md:py-10">
          <h2 className="font-serif text-4xl leading-none font-light tracking-[-0.02em] md:text-5xl">
            The exchange
          </h2>
          <p className="max-w-sm text-rock/60 sm:text-right">
            A full orderbook terminal, with the speed of a centralized venue.
          </p>
        </div>
      </section>
      <section className="w-full border-b border-rock/15">
        <div className="frame blueprint demo-backdrop px-4 pt-10 pb-12 md:px-12 md:pt-14 md:pb-16">
          <TerminalDemo />
        </div>
      </section>
    </>
  );
}
