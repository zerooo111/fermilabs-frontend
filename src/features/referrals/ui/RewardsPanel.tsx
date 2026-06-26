/**
 * The single home for money: claimable balance (the hero metric), the claim
 * action with min-payout progress, plus lifetime earned and referee count as
 * secondary stats. This is the only place the claimable number appears.
 */
import { useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

import { Button } from '@/shared/ui/button';
import { cn } from '@/lib/utils';

import { usd } from '../model/format';
import { Eyebrow, FOCUS_RING, Panel, PanelHeader } from './primitives';

export function RewardsPanel({
  claimable,
  lifetime,
  refereeCount,
  minClaim,
  onRequest,
  loading,
}: {
  claimable: number;
  lifetime: number;
  refereeCount: number;
  minClaim: number;
  onRequest: () => Promise<{ amount_usdc: number } | null>;
  loading: boolean;
}) {
  const [requesting, setRequesting] = useState(false);
  const belowMin = claimable < minClaim;
  const progress = minClaim > 0 ? Math.min(100, (claimable / minClaim) * 100) : 0;

  const handleRequest = async () => {
    setRequesting(true);
    posthog.capture('referral_payout_attempted', { claimable });
    const result = await onRequest();
    setRequesting(false);
    if (result) {
      toast.success(
        `Payout requested for ${usd(result.amount_usdc)}. We'll send it to your wallet and mark it complete.`
      );
      posthog.capture('referral_payout_succeeded', { amount_usdc: result.amount_usdc });
    } else {
      posthog.capture('referral_payout_failed');
    }
  };

  return (
    <Panel>
      <PanelHeader icon={Coins} title="Rewards" />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <Eyebrow>Claimable</Eyebrow>
          {loading ? (
            <div className="skeleton-bone h-8 w-28" />
          ) : (
            <span className="font-mono text-3xl font-semibold tabular-nums text-rock">
              {usd(claimable)}
            </span>
          )}
        </div>

        {!loading && belowMin && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1 w-full overflow-hidden bg-white/10">
              <div className="h-full bg-rock/50 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[11px] leading-relaxed text-white/55">
              Minimum payout is {usd(minClaim)}. Keep referring to reach it.
            </span>
          </div>
        )}

        <Button
          className={cn('w-full gap-2', FOCUS_RING)}
          disabled={loading || requesting || belowMin || claimable <= 0}
          onClick={handleRequest}
        >
          {requesting ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
          {belowMin ? `Reach ${usd(minClaim)} to claim` : 'Request payout'}
        </Button>

        <div className="grid grid-cols-2 gap-3 border-t border-outline pt-4">
          <Stat label="Lifetime earned" value={usd(lifetime)} loading={loading} />
          <Stat label="Referees" value={refereeCount.toLocaleString()} loading={loading} />
        </div>

        <p className="text-[11px] leading-relaxed text-white/55">
          Requesting moves the amount into a pending payout. We send the USDC to your wallet and
          mark it complete with the transaction.
        </p>
      </div>
    </Panel>
  );
}

function Stat({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      {loading ? (
        <div className="skeleton-bone h-5 w-16" />
      ) : (
        <span className="font-mono text-base font-semibold tabular-nums text-rock">{value}</span>
      )}
    </div>
  );
}
