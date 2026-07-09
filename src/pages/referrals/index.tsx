/**
 * Referrals page — the referral programme hub.
 *
 * A thin page shell (header + centred column) around the `ReferralDashboard`
 * feature, mirroring the vault page's layout conventions. All data, auth, and
 * actions live in the feature; the page only frames it.
 */
import { ReferralDashboard } from '@/features/referrals';

function ReferralsPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)] px-2 py-6 md:px-4 md:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight text-rock">Rewards</h1>
          <p className="text-sm text-white/60">
            Earn a rebate on your own fees, invite friends, and claim your rewards.
          </p>
        </div>

        <ReferralDashboard />
      </div>
    </div>
  );
}

export default ReferralsPage;
