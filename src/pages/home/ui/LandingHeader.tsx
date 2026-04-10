import { LINKS } from '../constants';
import { useState } from 'react';
import Logo from './Logo';

export default function LandingHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 w-full left-0 bg-dark-forest/60 backdrop-blur-lg border-b border-rock/30 z-10 gap-2 h-14 flex items-center">
      <nav className="flex flex-1 h-full justify-between items-center gap-1 text-xl md:border-x border-rock/20 font-medium container-2xl px-4">
        <div className="flex cursor-pointer items-center md:border-x h-full border-rock/20 md:pl-3 md:pr-4 group hover:text-amber-200 gap-2.5">
          <Logo className="w-4 h-4 group-hover:scale-125 duration-500" />
          <a className="text-xl md:text-2xl font-semibold" href="/">
            Fermi Trade
          </a>
        </div>

        <div className="hidden md:flex text-rock/80 items-center h-full border-x border-rock/20 divide-x divide-rock/20">
          <a
            href={LINKS.DOCS}
            target="_blank"
            rel="noreferrer"
            className="px-8 h-full flex items-center hover:text-amber-100 hover:bg-white/5 justify-center duration-150 ease-out"
          >
            Docs
          </a>
          <a
            href={LINKS.WHITEPAPER}
            target="_blank"
            rel="noreferrer"
            className="px-8 h-full flex items-center hover:text-amber-100 hover:bg-white/5 justify-center duration-150 ease-out"
          >
            Whitepaper
          </a>
          <a
            href={LINKS.APP}
            className="px-8 h-full flex items-center hover:text-amber-100 hover:bg-white/5 justify-center duration-150 ease-out"
          >
            Trade
          </a>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex flex-col justify-center items-center gap-1 w-8 h-8 group"
          aria-label="Toggle menu"
        >
          <span
            className={`block w-6 h-0.5 bg-rock/80 transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}
          />
          <span
            className={`block w-6 h-0.5 bg-rock/80 transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`block w-6 h-0.5 bg-rock/80 transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}
          />
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 w-full bg-dark-forest/95 backdrop-blur-lg border-b border-rock/30">
          <div className="flex flex-col text-rock/80 divide-y divide-rock/20">
            <a
              href={LINKS.DOCS}
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-6 py-4 hover:text-amber-100 hover:bg-white/5 duration-150 ease-out"
            >
              Docs
            </a>
            <a
              href={LINKS.WHITEPAPER}
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-6 py-4 hover:text-amber-100 hover:bg-white/5 duration-150 ease-out"
            >
              Whitepaper
            </a>
            <a
              href={LINKS.APP}
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-6 py-4 hover:text-amber-100 hover:bg-white/5 duration-150 ease-out"
            >
              Trade
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
