import { LINKS } from '../constants';

const CELL =
  'flex h-full items-center border-l border-rock/15 px-4 transition-colors duration-150 hover:bg-white/5 hover:text-amber-100 sm:px-6';

export default function LandingHeader() {
  return (
    <header className="glass-nav sticky top-0 z-[5] w-full border-b border-rock/15">
      <nav className="frame flex h-14 items-stretch justify-between">
        <a href="/" className="flex items-center gap-2.5 pl-5 hover:text-amber-200 md:pl-10">
          <img src="/logo.svg" alt="" width="21" height="12" className="h-3 w-auto" />
          <span className="font-serif text-xl tracking-tight">Fermi Trade</span>
        </a>
        <div className="flex items-stretch text-sm text-rock/75">
          <a href={LINKS.DOCS} target="_blank" rel="noreferrer" className={CELL}>
            Docs
          </a>
          <a
            href={LINKS.WHITEPAPER}
            target="_blank"
            rel="noreferrer"
            className={`${CELL} max-sm:hidden`}
          >
            Research
          </a>
          <a href={LINKS.APP} className={`${CELL} text-amber-200`}>
            Try the Beta
          </a>
        </div>
      </nav>
    </header>
  );
}
