import { LINKS } from '../constants';
import { WaitlistButton } from '@/features/waitlist';

export default function CTASection() {
  return (
    <>
      <div className="w-full border-b border-rock/15">
        <div className="frame dither-band" aria-hidden="true" />
      </div>
      <section className="w-full">
        <div className="frame reg px-5 py-16 md:px-10 md:py-24">
          <h2 className="max-w-3xl font-serif text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.1] font-light tracking-[-0.03em]">
            Ready to experience the fastest DEX?
          </h2>
          <p className="mt-6 max-w-xl text-lg text-rock/70">
            Deploy liquidity, fire off your first trade, or dive into our SDK in minutes.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <WaitlistButton
              source="cta"
              label="Join the waitlist"
              withArrow={false}
              className="cursor-pointer bg-amber-200 px-5 py-3 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100"
            />
            <a href={LINKS.DISCORD} target="_blank" rel="noreferrer" className="link text-rock/85">
              Join the Discord
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
