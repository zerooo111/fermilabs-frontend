/**
 * Points page — placeholder until the backend serves points data. The
 * dashboard (balances, epochs, pools) lands here; the rules live at /points/docs.
 */
import { Link } from 'react-router-dom';
import { PointsShell } from './ui/PointsShell';

function PointsPage() {
  return (
    <PointsShell>
      <section className="flex min-h-[60vh] flex-col items-start justify-center gap-6 px-5 py-20 md:px-10">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-amber-200">ALIEN Points</p>
        <h1 className="font-display text-4xl leading-tight md:text-5xl">
          Points dashboard coming soon
        </h1>
        <p className="max-w-xl text-rock/70">
          Your balances, epochs and pools will show here. Until then, read how points are earned and
          calculated.
        </p>
        <Link
          to="/points/docs"
          className="border border-amber-200/60 px-4 py-2 text-sm text-amber-200 transition-colors duration-150 hover:bg-amber-200 hover:text-dark-forest"
        >
          How ALIEN points work →
        </Link>
      </section>
    </PointsShell>
  );
}

export default PointsPage;
