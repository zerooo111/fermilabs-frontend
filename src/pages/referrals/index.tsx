/**
 * Referrals page — the referral programme hub.
 *
 * A thin page shell (header + centred column) around the `ReferralDashboard`
 * feature, mirroring the vault page's layout conventions. All data, auth, and
 * actions live in the feature; the page only frames it.
 */
import { ReferralDashboard, REWARD_RATE_LABEL } from '@/features/referrals';

function ReferralsPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)] px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-rock">Referrals</h1>
          <p className="text-rock/60">
            Share your code and earn {REWARD_RATE_LABEL} of the taker volume traded by everyone you
            refer — forever.
          </p>
        </div>

        <ReferralDashboard />
      </div>
    </div>
  );
}

export default ReferralsPage;
