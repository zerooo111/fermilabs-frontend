/**
 * Trading tab — the connected wallet's *own* trading, and the rebate it earns
 * on it.
 *
 * A rebate returns 10% of the fees you pay on your own trades, but **only while
 * you're bound to a referral code** (mirrors `db::REBATE_BPS`, gated on
 * `is_bound`). So the panel shows all-time volume + fees for everyone, and:
 *  - bound wallets see their accrued rebate as a live stat, and
 *  - unbound wallets see a nudge to apply a code (the rebate is $0 and locked).
 *
 * Money is read straight from the backend's `*_usdc` views — never lots→USDC
 * math here — matching the rest of the feature.
 */
import { BarChart3, Gift, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ReferralMe } from '../api/referralsClient';
import { REBATE_RATE_LABEL, REBATE_SHARE_LABEL, TAKER_FEE_LABEL } from '../model/constants';
import { usd } from '../model/format';
import { Eyebrow, Panel, PanelHeader } from './primitives';

export function TradingStatsPanel({ me, loading }: { me: ReferralMe | null; loading: boolean }) {
  const bound = me?.is_bound ?? false;

  return (
    <Panel>
      <PanelHeader icon={BarChart3} title="Trading stats" />
      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total volume traded"
            value={usd(me?.own_volume_usdc ?? 0)}
            loading={loading}
          />
          <StatCard
            label="Total fees paid"
            value={usd(me?.own_fees_usdc ?? 0)}
            hint={TAKER_FEE_LABEL}
            loading={loading}
          />
          <StatCard
            label="Rebate earned"
            value={usd(me?.rebate_reward_usdc ?? 0)}
            hint={bound ? REBATE_SHARE_LABEL : undefined}
            accent={bound}
            locked={!bound}
            loading={loading}
          />
        </div>

        {!loading &&
          (bound ? (
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/55">
              <Gift className="mt-px size-3.5 shrink-0 text-rock/70" />
              You get {REBATE_SHARE_LABEL} of the fees you pay back as a rebate ({REBATE_RATE_LABEL}{' '}
              of your volume), added to your claimable rewards. Only trades after you applied a code
              count.
            </p>
          ) : (
            <div className="flex items-start gap-2 border border-outline bg-card/40 px-3 py-2.5">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-white/45" />
              <p className="text-[11px] leading-relaxed text-white/60">
                Apply a referral code to unlock a{' '}
                <span className="text-rock">{REBATE_SHARE_LABEL} rebate</span> on the fees you pay.
                Head to the <span className="text-rock">Referrals</span> tab to add one.
              </p>
            </div>
          ))}
      </div>
    </Panel>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  locked,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  locked?: boolean;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 border border-outline bg-card/40 p-3">
      <div className="flex items-center gap-1.5">
        <Eyebrow>{label}</Eyebrow>
        {hint && <span className="font-mono text-[10px] text-white/35">{hint}</span>}
      </div>
      {loading ? (
        <div className="skeleton-bone h-6 w-20" />
      ) : (
        <span
          className={cn(
            'font-mono text-lg font-semibold tabular-nums',
            locked ? 'text-white/40' : accent ? 'text-rock' : 'text-white/90'
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}
