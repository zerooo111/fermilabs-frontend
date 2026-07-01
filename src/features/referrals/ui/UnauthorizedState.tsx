/**
 * Shown when the wallet is disconnected or lacks gate access — the one place
 * the value proposition is pitched before the user can mint a code.
 */
import { Gift } from 'lucide-react';

import { REWARD_RATE_LABEL } from '../model/constants';
import { Panel } from './primitives';

export function UnauthorizedState({ connected }: { connected: boolean }) {
  return (
    <Panel>
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex size-11 items-center justify-center border border-outline bg-card text-rock">
          <Gift className="size-5" />
        </div>
        <h2 className="text-base font-medium text-rock">Referral programme</h2>
        <p className="max-w-md text-sm leading-relaxed text-white/65">
          Earn {REWARD_RATE_LABEL} of every trade your friends make on Fermi — forever, paid
          in&nbsp;USDC.
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-white/55">
          {connected
            ? 'This wallet does not have access yet. Redeem an invite to mint your referral code and start earning.'
            : 'Connect a whitelisted wallet to mint your referral code, track referrals, and claim rewards.'}
        </p>
      </div>
    </Panel>
  );
}
