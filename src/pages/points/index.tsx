/**
 * Points page: check any wallet, see where the season is, how to earn and
 * who leads. With ?wallet= that wallet's points, and its alien, show under
 * the checker. The rules live at /points/docs.
 */
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AddressChecker,
  EarnMore,
  PixelAlien,
  SeasonStrip,
  TopWallets,
  isValidAddress,
  usePointsAccount,
  useNow,
} from '@/features/points';
import { PointsShell } from './ui/PointsShell';
import { WalletResults } from './ui/WalletResults';
import './points.css';

/** Seed for the hero's alien; a checked wallet's own alien shows by its score. */
const HERO_ALIEN = 'ALiENpointsSeason1xxxxxxxxxxxxxxxxxxxxxxxx';

function PointsPage() {
  const [params] = useSearchParams();
  const wallet = params.get('wallet')?.trim() || null;
  const valid = !!wallet && isValidAddress(wallet);
  const now = useNow();
  const { data: account } = usePointsAccount(valid ? wallet : undefined);

  // Checking a wallet from the page (the checker, or a top wallet further
  // down) scrolls to its results. A link that opens the page with ?wallet=
  // starts at the top.
  const resultsRef = useRef<HTMLDivElement>(null);
  const shown = useRef(wallet);
  useEffect(() => {
    if (wallet === shown.current) return;
    shown.current = wallet;
    if (wallet) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [wallet]);

  return (
    <PointsShell>
      <section className="points-sky w-full border-b border-rock/10">
        <div className="grid items-center gap-10 px-5 pt-14 pb-12 md:grid-cols-[minmax(0,1fr)_auto] md:px-10 md:pt-20 md:pb-16">
          <div className="flex flex-col gap-6">
            <h1 className="max-w-2xl font-serif text-5xl leading-[1.02] font-light tracking-[-0.02em] md:text-7xl">
              How many points has your wallet earned?
            </h1>
            <p className="max-w-lg text-lg text-rock/70">
              Paste any Solana address to see its ALIEN points, its rank and how to earn more.
            </p>
            {/* key: a new address in the URL resets the field to it */}
            <AddressChecker key={wallet ?? ''} initial={wallet ?? ''} />
            <div className="max-w-2xl">
              <SeasonStrip now={now} />
            </div>
          </div>
          <div className="relative mx-auto hidden w-56 md:block lg:w-72" aria-hidden>
            <div className="points-alien">
              <PixelAlien wallet={HERO_ALIEN} className="w-full" />
            </div>
            <div className="points-beam" />
          </div>
        </div>
      </section>

      {wallet && (
        <div ref={resultsRef} className="scroll-mt-12 border-b border-rock/10 px-5 py-10 md:px-10">
          <WalletResults wallet={wallet} />
        </div>
      )}

      <div className="grid gap-10 px-5 py-10 md:px-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section>
          <h2 className="mb-4 font-serif text-3xl font-light">
            {account && account.total > 0 ? 'Earn more' : 'How to earn'}
          </h2>
          <EarnMore account={account} now={now} />
          <Link to="/points/docs" className="link mt-4 inline-block text-sm text-rock/70">
            Read the full rules
          </Link>
        </section>
        <section>
          <h2 className="mb-4 font-serif text-3xl font-light">Leaderboard</h2>
          <TopWallets limit={10} current={valid ? wallet : undefined} />
        </section>
      </div>
    </PointsShell>
  );
}

export default PointsPage;
