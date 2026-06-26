/**
 * A thin, static three-step explainer that turns the abstract reward rate into
 * a concrete story: share → friend trades → you earn, forever, in USDC.
 */
import { Coins, Share2, TrendingUp } from 'lucide-react';

import { REWARD_RATE_LABEL } from '../model/constants';
import { Panel } from './primitives';

const STEPS = [
  { icon: Share2, title: 'Share your code', body: 'Send your code or link to friends.' },
  { icon: TrendingUp, title: 'They trade', body: 'They join Fermi and start trading.' },
  {
    icon: Coins,
    title: 'You earn, forever',
    body: `Collect ${REWARD_RATE_LABEL} of their taker volume in USDC.`,
  },
];

export function HowItWorks() {
  return (
    <Panel>
      <div className="grid grid-cols-1 divide-y divide-outline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex items-start gap-3 p-4">
            <div className="flex size-8 shrink-0 items-center justify-center border border-outline bg-card text-rock">
              <step.icon className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="flex items-baseline gap-1.5 text-sm font-medium text-rock">
                <span className="font-mono text-xs tabular-nums text-white/40">{i + 1}</span>
                {step.title}
              </span>
              <span className="text-xs leading-relaxed text-white/60">{step.body}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
