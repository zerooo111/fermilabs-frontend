/**
 * Referral dashboard — the full-page hub for the referral programme.
 *
 * Two audiences share the page:
 *  - Referrers (the common case): mint/share their code, watch referees +
 *    accrued rewards, and claim. The page is built share-first for them.
 *  - Referees: apply a friend's code (pre-filled from a `?ref=` share link) at
 *    any time — once per wallet, forever. This is the de-emphasized footer.
 *
 * Layout, top → bottom: share hero → how-it-works → (referees + payouts | the
 * rewards card) → were-you-referred footer. Visual language follows the trading
 * terminal: flat `border-outline` panels, no rounded cards, money read straight
 * from the backend's `*_usdc` views (never lots→USDC math client-side).
 *
 * This is a thin composition root; each panel owns its own loading/empty state.
 */
import { useWallet } from '@solana/wallet-adapter-react';

import { useReferrals } from '../model/useReferrals';
import { BindPanel } from './BindPanel';
import { HeroPanel } from './HeroPanel';
import { HowItWorks } from './HowItWorks';
import { PayoutsPanel } from './PayoutsPanel';
import { RefereesPanel } from './RefereesPanel';
import { RewardsPanel } from './RewardsPanel';
import { UnauthorizedState } from './UnauthorizedState';

export function ReferralDashboard() {
  const { publicKey } = useWallet();
  const {
    authorized,
    me,
    referees,
    payouts,
    loading,
    error,
    createCode,
    bind,
    requestPayout,
    refresh,
  } = useReferrals();

  if (!publicKey || !authorized) {
    return <UnauthorizedState connected={!!publicKey} />;
  }

  const initialLoad = loading && !me;

  return (
    <div className="flex flex-col gap-4">
      <HeroPanel codes={me?.codes ?? []} onCreate={createCode} loading={initialLoad} />

      {error && (
        <div className="border border-danger/40 bg-danger/10 px-4 py-2.5 text-xs text-danger">
          {error}
        </div>
      )}

      <HowItWorks />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <RefereesPanel referees={referees} loading={initialLoad} />
          <PayoutsPanel payouts={payouts} loading={initialLoad} />
        </div>
        <RewardsPanel
          claimable={me?.claimable_usdc ?? 0}
          lifetime={me?.lifetime_reward_usdc ?? 0}
          refereeCount={me?.referee_count ?? 0}
          minClaim={me?.min_claim_usdc ?? 0}
          onRequest={requestPayout}
          loading={initialLoad}
        />
      </div>

      <BindPanel referredBy={me?.referred_by ?? null} onBind={bind} onBound={refresh} />
    </div>
  );
}
