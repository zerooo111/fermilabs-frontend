/**
 * Points page, in the landing's drawing-sheet layout: a hero with the UFO
 * scene and the checker, then (with ?wallet=) that wallet's points, then the
 * ways to earn. The rules live at /points/docs.
 */
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AddressChecker,
  EarnMore,
  Label,
  SeasonBanner,
  isValidAddress,
  usePointsAccount,
  useNow,
} from '@/features/points';
import { SkyScene } from '@/pages/home/ui/SkyScene';
import { PointsShell } from './ui/PointsShell';
import { WalletResults } from './ui/WalletResults';
import './points.css';

function PointsPage() {
  const [params] = useSearchParams();
  const wallet = params.get('wallet')?.trim() || null;
  const valid = !!wallet && isValidAddress(wallet);
  const now = useNow();
  const { data: account } = usePointsAccount(valid ? wallet : undefined);

  // Checking a wallet from the page scrolls to its results. A link that opens
  // the page with ?wallet= starts at the top.
  const resultsRef = useRef<HTMLDivElement>(null);
  const shown = useRef(wallet);
  useEffect(() => {
    if (wallet === shown.current) return;
    shown.current = wallet;
    if (wallet) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [wallet]);

  return (
    <PointsShell>
      <SeasonBanner now={now} />
      <section className="relative isolate overflow-hidden border-b border-rock/15 px-5 pt-16 pb-12 md:px-10 md:pt-24 md:pb-16">
        {/* The landing hero's sky and UFO; the UFO hides on phones */}
        <SkyScene ufoClassName="right-6 bottom-0 hidden w-[min(42%,500px)] md:block" />
        <div className="flex flex-col md:max-w-[56%]">
          <Label className="mb-6 md:mb-8">ALIEN points, season 1</Label>
          <h1 className="font-serif text-[clamp(2.5rem,5.5vw,4.75rem)] leading-[1.1] font-light tracking-[-0.03em]">
            How many points has your wallet earned?
          </h1>
          <p className="mt-6 max-w-xl text-lg text-rock/70">
            Paste any Solana address to see its points, its rank and how to earn more.
          </p>
          {/* key: a new address in the URL resets the field to it */}
          <AddressChecker key={wallet ?? ''} initial={wallet ?? ''} className="mt-8" />
        </div>
      </section>

      {wallet && (
        <div ref={resultsRef} className="scroll-mt-14">
          <WalletResults wallet={wallet} />
        </div>
      )}

      <section className="reg flex flex-col gap-4 border-b border-rock/15 px-5 py-8 sm:flex-row sm:items-end sm:justify-between md:px-10 md:py-10">
        <h2 className="font-serif text-4xl leading-none font-light tracking-[-0.02em] md:text-5xl">
          {account && account.total > 0 ? 'Earn more' : 'How to earn'}
        </h2>
        <Link to="/points/docs" className="link self-start text-rock/85 sm:self-auto">
          Read the full rules
        </Link>
      </section>
      <section>
        <EarnMore account={account} now={now} />
      </section>
    </PointsShell>
  );
}

export default PointsPage;
