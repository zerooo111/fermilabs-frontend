/**
 * Rewards dashboard — the full-page hub for trading rebates + the referral
 * programme, unified around one claimable balance.
 *
 * Layout mirrors the reference design in our own visual language:
 *  - Left, a two-tab surface:
 *      · "Trading"   — your own volume, fees paid, and the rebate you earn on
 *                      them (10% of your fees, but only while bound to a code).
 *      · "Referrals" — mint/share your code, watch referees + accrued referral
 *                      rewards, and apply a friend's code.
 *  - Right rail, the common "rewards + payout" section shared by both sources:
 *      the combined total earned, the claimable balance + claim, and the payout
 *      (distribution) history.
 *
 * Visual language follows the trading terminal: flat `border-outline` panels,
 * money read straight from the backend's `*_usdc` views (never lots→USDC math
 * client-side). This is a thin composition root; each panel owns its own
 * loading/empty state.
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'react-router-dom';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

import { useReferrals } from '../model/useReferrals';
import { BindPanel } from './BindPanel';
import { HeroPanel } from './HeroPanel';
import { HowItWorks } from './HowItWorks';
import { PayoutsPanel } from './PayoutsPanel';
import { RefereesPanel } from './RefereesPanel';
import { RewardsPanel } from './RewardsPanel';
import { TradingStatsPanel } from './TradingStatsPanel';
import { UnauthorizedState } from './UnauthorizedState';

export function ReferralDashboard() {
  const { publicKey } = useWallet();
  const [searchParams] = useSearchParams();
  const hasRef = !!searchParams.get('ref');
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
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {error && (
          <div className="border border-danger/40 bg-danger/10 px-4 py-2.5 text-xs text-danger">
            {error}
          </div>
        )}

        {/* A ?ref= share link points at this page for an already-authorized
            wallet to apply a friend's code — the BindPanel lives in the
            Referrals tab and auto-opens/fills from ?ref, so open that tab by
            default when the param is present (new users bind at the gate). */}
        <Tabs defaultValue={hasRef ? 'referrals' : 'trading'}>
          <TabsList className="w-full justify-start border-b border-outline">
            <TabsTrigger value="trading">Trading</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
          </TabsList>

          <TabsContent value="trading" className="pt-4">
            <TradingStatsPanel me={me} loading={initialLoad} />
          </TabsContent>

          <TabsContent value="referrals" className="flex flex-col gap-4 pt-4">
            <HeroPanel codes={me?.codes ?? []} onCreate={createCode} loading={initialLoad} />
            <HowItWorks />
            <RefereesPanel referees={referees} loading={initialLoad} />
            <BindPanel referredBy={me?.referred_by ?? null} onBind={bind} onBound={refresh} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col gap-4">
        <RewardsPanel
          claimable={me?.claimable_usdc ?? 0}
          lifetime={me?.lifetime_reward_usdc ?? 0}
          referral={me?.referral_reward_usdc ?? 0}
          rebate={me?.rebate_reward_usdc ?? 0}
          minClaim={me?.min_claim_usdc ?? 0}
          onRequest={requestPayout}
          loading={initialLoad}
        />
        <PayoutsPanel payouts={payouts} loading={initialLoad} />
      </div>
    </div>
  );
}
