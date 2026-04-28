import { ArrowRight } from '@phosphor-icons/react';
import { LINKS } from '../constants';
import { WaitlistButton } from '@/features/waitlist';

export default function CTASection() {
  return (
    <div className="flex flex-col items-center justify-between py-12 md:py-20 px-4">
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-7xl mb-4 md:mb-6 leading-tight text-rock text-center">
        Ready to experience the fastest DEX?
      </h2>
      <p className="text-lg sm:text-xl md:text-2xl text-rock/80 mx-auto text-center max-w-2xl">
        Deploy liquidity, fire off your first trade, or dive into our SDK in minutes.
      </p>

      <div className="mt-8 md:mt-16 flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6 w-full sm:w-auto">
        <WaitlistButton source="cta" />

        <a
          href={LINKS.DISCORD}
          target="_blank"
          rel="noreferrer"
          className="hover:brightness-120 bg-amber-200 group text-dark-forest px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl md:text-2xl font-medium flex items-center justify-center gap-3 sm:gap-4 relative overflow-hidden duration-150 ease-out"
        >
          Join Discord
          <ArrowRight
            weight="bold"
            size={20}
            className="group-hover:scale-110 origin-center
              group-hover:-rotate-45 transition-all duration-200 relative sm:w-6 sm:h-6"
          />
        </a>
      </div>
    </div>
  );
}
