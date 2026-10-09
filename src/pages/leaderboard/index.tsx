/**
 * Leaderboard page — public perps ranking by volume or trade count.
 * A thin shell around the `Leaderboard` feature, matching the referrals page.
 */
import { Leaderboard } from '@/features/leaderboard';

function LeaderboardPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] px-2 py-6 md:px-4 md:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight text-rock">Leaderboard</h1>
          <p className="text-sm text-white/60">Top perps traders, ranked by volume or trades.</p>
        </div>

        <Leaderboard />
      </div>
    </div>
  );
}

export default LeaderboardPage;
