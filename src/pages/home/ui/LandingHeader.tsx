import { LINKS } from '../constants';
import { useState } from 'react';
import Logo from './Logo';
import { WaitlistButton } from '@/features/waitlist';

export default function LandingHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 w-full left-0 bg-surface-brand/60 backdrop-blur-lg border-b border-line-on-brand-strong z-10 gap-2 h-14 flex items-center">
      <nav className="flex flex-1 h-full justify-between items-center gap-1 text-xl md:border-x border-line-on-brand font-medium container-2xl px-4">
        <div className="flex cursor-pointer items-center md:border-x h-full border-line-on-brand md:pl-3 md:pr-4 group hover:text-accent-fg gap-2.5">
          <Logo className="w-4 h-4 group-hover:scale-125 duration-500" />
          <a className="text-xl md:text-2xl font-semibold" href="/">
            Fermi Trade
          </a>
        </div>

        <div className="hidden md:flex text-fg-secondary items-center h-full border-x border-line-on-brand divide-x divide-line-on-brand">
          <a
            href={LINKS.DOCS}
            target="_blank"
            rel="noreferrer"
            className="px-8 h-full flex items-center hover:text-accent-fg hover:bg-state-hover justify-center duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
          >
            Docs
          </a>
          <a
            href={LINKS.WHITEPAPER}
            target="_blank"
            rel="noreferrer"
            className="px-8 h-full flex items-center hover:text-accent-fg hover:bg-state-hover justify-center duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
          >
            Research
          </a>
          <WaitlistButton
            source="header"
            label="Join Waitlist"
            withArrow={false}
            className="px-8 h-full flex items-center justify-center hover:text-accent-fg hover:bg-state-hover duration-150 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex flex-col justify-center items-center gap-1 w-8 h-8 group outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          aria-label="Toggle menu"
        >
          <span
            className={`block w-6 h-0.5 bg-fg-secondary transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}
          />
          <span
            className={`block w-6 h-0.5 bg-fg-secondary transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`block w-6 h-0.5 bg-fg-secondary transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}
          />
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 w-full bg-surface-brand/95 backdrop-blur-lg border-b border-line-on-brand-strong">
          <div className="flex flex-col text-fg-secondary divide-y divide-line-on-brand">
            <a
              href={LINKS.DOCS}
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-6 py-4 hover:text-accent-fg hover:bg-state-hover duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
            >
              Docs
            </a>
            <a
              href={LINKS.WHITEPAPER}
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-6 py-4 hover:text-accent-fg hover:bg-state-hover duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
            >
              Research
            </a>
            <WaitlistButton
              source="header-mobile"
              label="Join Waitlist"
              withArrow={false}
              className="px-6 py-4 text-left hover:text-accent-fg hover:bg-state-hover duration-150 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </header>
  );
}
