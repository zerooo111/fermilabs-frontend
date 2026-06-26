/**
 * Payout request history. Hidden entirely until there's a payout to show, so it
 * never adds clutter for users who haven't claimed yet. Built on the shared
 * Table; status uses the shared Badge with a leading status dot.
 */
import { Fragment } from 'react';
import { Receipt } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { cn } from '@/lib/utils';
import { solanaExplorerTxUrl } from '@/shared/config/constants';

import type { Payout, PayoutStatus } from '../api/referralsClient';
import { formatDate, usd } from '../model/format';
import { Eyebrow, FOCUS_RING, Panel, PanelEmpty, PanelHeader } from './primitives';

const TH = 'h-9 px-4';
const TD = 'px-4 py-2.5';

const STATUS: Record<
  PayoutStatus,
  { dot: string; label: string; variant: React.ComponentProps<typeof Badge>['variant'] }
> = {
  requested: { dot: 'bg-white/50', label: 'Requested', variant: 'secondary' },
  processing: { dot: 'bg-amber-400', label: 'Processing', variant: 'outline' },
  completed: { dot: 'bg-success', label: 'Completed', variant: 'success' },
  failed: { dot: 'bg-danger', label: 'Failed', variant: 'danger' },
};

function StatusBadge({ status }: { status: PayoutStatus }) {
  const s = STATUS[status] ?? STATUS.requested;
  return (
    <Badge variant={s.variant} className="gap-1.5">
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </Badge>
  );
}

export function PayoutsPanel({ payouts, loading }: { payouts: Payout[]; loading: boolean }) {
  // Hide the panel entirely until there's a payout to show.
  if (!loading && payouts.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        icon={Receipt}
        title="Payouts"
        right={
          payouts.length > 0 ? (
            <Eyebrow className="tabular-nums">{payouts.length}</Eyebrow>
          ) : undefined
        }
      />
      {loading ? (
        <PanelEmpty loading />
      ) : (
        <div className="max-h-[360px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className={TH}>
                  <Eyebrow>Amount</Eyebrow>
                </TableHead>
                <TableHead className={TH}>
                  <Eyebrow>Requested</Eyebrow>
                </TableHead>
                <TableHead className={`${TH} text-right`}>
                  <Eyebrow>Status</Eyebrow>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map(p => {
                const hasDetail = !!(p.tx_signature || p.note);
                return (
                  <Fragment key={p.id}>
                    <TableRow className={hasDetail ? 'border-0 hover:bg-transparent' : undefined}>
                      <TableCell
                        className={cn(
                          TD,
                          'font-mono text-xs tabular-nums text-rock',
                          hasDetail && 'border-0 pb-1'
                        )}
                      >
                        {usd(p.amount_usdc)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          TD,
                          'font-mono text-xs text-white/55',
                          hasDetail && 'border-0 pb-1'
                        )}
                      >
                        {formatDate(p.requested_at)}
                      </TableCell>
                      <TableCell className={cn(TD, 'text-right', hasDetail && 'border-0 pb-1')}>
                        <div className="flex justify-end">
                          <StatusBadge status={p.status} />
                        </div>
                      </TableCell>
                    </TableRow>
                    {hasDetail && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="px-4 pt-0 pb-2.5">
                          {p.tx_signature && (
                            <a
                              href={solanaExplorerTxUrl(p.tx_signature)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                'truncate font-mono text-[11px] text-white/55 underline-offset-2 transition-colors hover:text-white/80 hover:underline',
                                FOCUS_RING
                              )}
                            >
                              tx {p.tx_signature.slice(0, 8)}…{p.tx_signature.slice(-8)}
                            </a>
                          )}
                          {p.note && (
                            <span className="block text-[11px] text-white/55">{p.note}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
