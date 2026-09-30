import { LINKS } from '../constants';
import { DiscordLogo, XLogo } from '@phosphor-icons/react';
import Copyright from './Copyright';
import Logo from './Logo';
import { WaitlistButton } from '@/features/waitlist';

export function LandingFooter() {
  return (
    <footer className="w-full relative border-t border-line-on-brand-strong ">
      <div className="container-2xl md:h-16 md:border-x border-x-line-on-brand flex flex-col md:flex-row items-center md:items-start justify-between lg:px-4">
        <div className="w-full md:w-auto md:h-full">
          <div className="flex flex-col sm:flex-row md:inline-flex text-fg-secondary text-lg md:text-xl font-medium items-stretch md:items-center md:h-full md:border-x border-line-on-brand divide-y sm:divide-y-0 sm:divide-x divide-line-on-brand">
            <a
              href={LINKS.DOCS}
              target="_blank"
              rel="noreferrer"
              className="px-6 md:px-8 py-4 md:py-0 md:h-full flex items-center hover:text-accent-fg hover:bg-state-hover justify-center duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
            >
              Docs
            </a>
            <a
              href={LINKS.WHITEPAPER}
              target="_blank"
              rel="noreferrer"
              className="px-6 md:px-8 py-4 md:py-0 md:h-full flex items-center hover:text-accent-fg hover:bg-state-hover justify-center duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
            >
              Research
            </a>
            <WaitlistButton
              source="footer"
              label="Join Waitlist"
              withArrow={false}
              className="px-6 md:px-8 py-4 md:py-0 md:h-full flex items-center justify-center hover:text-accent-fg hover:bg-state-hover duration-150 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
            />
          </div>
        </div>

        <div className="flex text-fg-secondary text-xl items-center py-4 md:py-0 md:h-full md:border-x border-line-on-brand divide-x divide-line-on-brand">
          <a
            href={LINKS.TWITTER}
            title="X / Twitter"
            target="_blank"
            rel="noreferrer"
            className="px-4 sm:px-6 gap-2 group hover:scale-100 h-12 md:h-full flex items-center hover:text-accent-fg hover:bg-state-hover justify-center duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
          >
            <XLogo className="size-6 sm:size-8" />
          </a>
          <a
            href={LINKS.DISCORD}
            title="Discord"
            target="_blank"
            rel="noreferrer"
            className="px-4 sm:px-6 h-12 md:h-full flex hover:scale-100 items-center hover:text-accent-fg hover:bg-state-hover justify-center duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
          >
            <DiscordLogo className="size-6 sm:size-8" />
          </a>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t py-4 border-t-line-on-brand container-2xl md:border-x border-x-line-on-brand px-4">
        <div className="flex items-center border-line-on-brand pr-4 group hover:text-accent-fg gap-1">
          <Logo className="w-8 h-8 sm:w-10 sm:h-10 group-hover:rotate-360 duration-500" />
          <a className="text-2xl sm:text-3xl font-display tracking-wide" href="/">
            Fermi Trade
          </a>
        </div>
        <Copyright />
      </div>
    </footer>
  );
}
