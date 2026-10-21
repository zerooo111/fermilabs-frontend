/**
 * Points page, in the landing's drawing-sheet layout: a hero with the UFO
 * scene and the checker, then two tabs (the checked wallet's points, and the
 * leaderboard), then the ways to earn. The rules live at /points/docs.
 */
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { cn } from '@/shared/lib/utils';
import {
  AddressChecker,
  EarnMore,
  Label,
  Leaderboard,
  Notice,
  SeasonBanner,
  isValidAddress,
  usePointsAccount,
  useNow,
} from '@/features/points';
import { SkyScene } from '@/pages/home/ui/SkyScene';
import { PointsShell } from './ui/PointsShell';
import { WalletResults } from './ui/WalletResults';
import './points.css';

type Tab = 'wallet' | 'leaderboard';

const TABS: { id: Tab; label: string }[] = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

function PointsPage() {
  const [params, setParams] = useSearchParams();
  const wallet = params.get('wallet')?.trim() || null;
  const valid = !!wallet && isValidAddress(wallet);
  const connected = useWallet().publicKey?.toBase58();
  // A checked wallet opens on its points; otherwise the leaderboard.
  const asked = params.get('tab');
  const tab: Tab =
    asked === 'wallet' || asked === 'leaderboard' ? asked : wallet ? 'wallet' : 'leaderboard';
  const showTab = (next: Tab) =>
    setParams(
      prev => {
        const p = new URLSearchParams(prev);
        p.set('tab', next);
        return p;
      },
      { replace: true }
    );
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

      <div ref={resultsRef} className="scroll-mt-14">
        <div
          role="tablist"
          aria-label="Points"
          className="reg flex border-b border-rock/15 px-5 md:px-10"
        >
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`points-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`points-panel-${t.id}`}
              onClick={() => showTab(t.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-4 text-xs tracking-[0.2em] uppercase transition-colors duration-150',
                tab === t.id
                  ? 'border-amber-200 text-rock'
                  : 'border-transparent text-rock/55 hover:text-rock'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`points-panel-${tab}`} aria-labelledby={`points-tab-${tab}`}>
          {tab === 'leaderboard' ? (
            <section className="border-b border-rock/15 px-5 py-8 md:px-10 md:py-10">
              <Leaderboard me={valid ? wallet : connected} />
            </section>
          ) : wallet ? (
            <WalletResults wallet={wallet} />
          ) : (
            <section className="border-b border-rock/15 px-5 py-8 md:px-10 md:py-10">
              <Notice title="Check a wallet to see its points.">
                Paste an address above, or connect your wallet.
              </Notice>
            </section>
          )}
        </div>
      </div>

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
