import { ArrowRight } from '@phosphor-icons/react';
import { useRef } from 'react';

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={containerRef}
      className="relative w-full px-4 border-b border-b-rock/20 overflow-hidden"
    >
      <div className="flex flex-col items-center  relative pt-12 md:pt-24">
        <h1 className="text-5xl lg:text-7xl leading-tight md:leading-relaxed font-display text-center md:text-left">
          Instant Finality. <br className="block md:hidden" /> Capital Efficient
        </h1>

        <h6 className="text-lg sm:text-xl md:text-2xl lg:text-3xl italic text-center md:text-left mt-4">
          Trade with NASDAQ speed with onchain security
        </h6>

        <div className="mt-8 md:mt-16 flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto">
          <span
            aria-disabled="true"
            className="bg-rock/70 text-dark-forest px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl md:text-2xl font-medium flex items-center justify-center gap-3 sm:gap-4 relative overflow-hidden cursor-default select-none"
          >
            Coming Soon
          </span>

          <a
            href={'#features'}
            className="hover:brightness-120 bg-amber-200 group text-dark-forest px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl md:text-2xl font-medium flex items-center justify-center gap-3 sm:gap-4 relative overflow-hidden duration-150 ease-out"
          >
            Explore
            <ArrowRight
              weight="bold"
              size={20}
              className="group-hover:scale-110 origin-center group-hover:rotate-45 transition-all relative duration-150 ease-out sm:w-6 sm:h-6"
            />
          </a>
        </div>
      </div>

      <div className="flex md:translate-y-10 lg:translate-y-20 mt-8 overflow-hidden">
        <img
          src="https://ik.imagekit.io/xl6qa7mr1/product-screenshot.svg?tr=w-1200,f-auto,q-75"
          srcSet="https://ik.imagekit.io/xl6qa7mr1/product-screenshot.svg?tr=w-800,f-auto,q-75 800w, https://ik.imagekit.io/xl6qa7mr1/product-screenshot.svg?tr=w-1200,f-auto,q-75 1200w, https://ik.imagekit.io/xl6qa7mr1/product-screenshot.svg?tr=w-1600,f-auto,q-75 1600w"
          sizes="(max-width: 768px) 100vw, (max-width: 1536px) 90vw, 1600px"
          alt="Product Screenshot"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          width="1200"
          height="800"
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Gradients */}

      <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/3 mix-blend-multiply h-200 blur-3xl opacity-40 w-120  bg-black/20 blur-5xl -skew-x-24 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-soft-light opacity-40 blur-3xl h-80 w-2/3 bg-radial from-amber-100 to-rock/25 to-70% blur-5xl " />
    </section>
  );
}
