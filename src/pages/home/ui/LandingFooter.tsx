import { LINKS } from '../constants';

const LINK = 'transition-colors duration-150 hover:text-amber-100';

export function LandingFooter() {
  return (
    <footer className="w-full">
      <div className="frame reg border-t border-rock/15">
        <div className="dither-footer" aria-hidden="true" />
        <div className="flex flex-col gap-4 border-t border-rock/15 px-5 py-6 text-sm text-rock/60 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <p>
            &copy; {new Date().getFullYear()} Fermi Trade. Built by{' '}
            <a href={LINKS.LABS} target="_blank" rel="noreferrer" className="link">
              Fermi Labs
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <a href={LINKS.DOCS} target="_blank" rel="noreferrer" className={LINK}>
              Docs
            </a>
            <a href={LINKS.WHITEPAPER} target="_blank" rel="noreferrer" className={LINK}>
              Research
            </a>
            <a href={LINKS.TWITTER} target="_blank" rel="noreferrer" className={LINK}>
              X
            </a>
            <a href={LINKS.DISCORD} target="_blank" rel="noreferrer" className={LINK}>
              Discord
            </a>
            <a href={LINKS.BLOG} target="_blank" rel="noreferrer" className={LINK}>
              Substack
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
