/**
 * Wallets that joined with this user's code, with the volume they've traded and
 * the reward it has accrued. Built on the shared Table for semantics + a single
 * styling source. Empty state reinforces sharing.
 */
import { Users } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

import type { RefereeView } from '../api/referralsClient';
import { formatDate, shortWallet, usd } from '../model/format';
import { Eyebrow, Panel, PanelEmpty, PanelHeader } from './primitives';

const TH = 'h-9 px-4';
const TD = 'px-4 py-2.5';

export function RefereesPanel({
  referees,
  loading,
}: {
  referees: RefereeView[];
  loading: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        icon={Users}
        title="Your referees"
        right={
          referees.length > 0 ? (
            <Eyebrow className="tabular-nums">{referees.length}</Eyebrow>
          ) : undefined
        }
      />

      {loading ? (
        <PanelEmpty loading />
      ) : referees.length === 0 ? (
        <PanelEmpty>No one&apos;s used your code yet. Share it to start earning.</PanelEmpty>
      ) : (
        <div className="max-h-[360px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className={TH}>
                  <Eyebrow>Wallet</Eyebrow>
                </TableHead>
                <TableHead className={TH}>
                  <Eyebrow>Joined</Eyebrow>
                </TableHead>
                <TableHead className={`${TH} text-right`}>
                  <Eyebrow>Volume</Eyebrow>
                </TableHead>
                <TableHead className={`${TH} text-right`}>
                  <Eyebrow>Earned</Eyebrow>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referees.map(r => (
                <TableRow key={r.referee_wallet}>
                  <TableCell className={`${TD} font-mono text-xs text-rock/90`}>
                    {shortWallet(r.referee_wallet)}
                  </TableCell>
                  <TableCell className={`${TD} font-mono text-xs text-white/55`}>
                    {formatDate(r.bound_at)}
                  </TableCell>
                  <TableCell
                    className={`${TD} text-right font-mono text-xs tabular-nums text-white/75`}
                  >
                    {usd(r.accrued_volume_usdc)}
                  </TableCell>
                  <TableCell
                    className={`${TD} text-right font-mono text-xs tabular-nums text-rock`}
                  >
                    {usd(r.accrued_reward_usdc)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
