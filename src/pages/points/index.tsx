/**
 * Points home: a public checker for any address, the season schedule and the
 * top of the ranking. With ?wallet= the route shows that wallet's dashboard
 * instead (see the router); the rules live at /points/docs.
 */
import { Link } from 'react-router-dom';
import { AddressChecker, Eyebrow, SeasonOverview, TopWallets } from '@/features/points';
import { PointsShell } from './ui/PointsShell';

function PointsPage() {
  return (
    <PointsShell>
      <section className="w-full border-b border-rock/15">
        <div className="reg flex flex-col gap-6 px-5 pt-16 pb-12 md:px-10 md:pt-24 md:pb-16">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-amber-200">
            ALIEN Points · Season 1
          </p>
          <h1 className="max-w-3xl font-serif text-4xl leading-[1.05] font-light tracking-[-0.02em] md:text-6xl">
            Check any wallet&apos;s points
          </h1>
          <p className="max-w-xl text-rock/70">
            Points come from the FLP vault, resting orders, volume, open interest and referrals.
            Paste an address to see its balance, rank and what earned it.
          </p>
          <AddressChecker />
          <Link to="/points/docs" className="link w-fit text-sm text-rock/70">
            How ALIEN points work →
          </Link>
        </div>
      </section>

      <div className="grid border-b border-rock/15 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="border-rock/15 px-5 py-8 max-lg:border-b md:px-10 md:py-10 lg:border-r">
          <Eyebrow className="mb-4">Season</Eyebrow>
          <SeasonOverview />
        </section>
        <section className="px-5 py-8 md:px-10 md:py-10">
          <Eyebrow className="mb-4">Top wallets</Eyebrow>
          <TopWallets limit={10} />
        </section>
      </div>
    </PointsShell>
  );
}

export default PointsPage;
