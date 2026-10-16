/**
 * The tabbed tables under a vault: who's in it (depositors) and what moved
 * (deposits, withdrawals, claims), optionally narrowed to the connected
 * wallet. Both come from the gateway's copy of chain state.
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AccountAvatar } from '@/features/wallet-connect';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { TabStrip, TabStripItem } from '@/shared/ui/tab-strip';

import type { Vault, VaultEvent, VaultEventKind } from '../../api/vaultsClient';
import {
  explorerTxUrl,
  formatDateTime,
  num,
  shortAddress,
  tone,
  usd,
  usdSigned,
} from '../../model/format';
import { useVaultActivity, useVaultDepositors, useWalletAddress } from '../../model/useVaults';
import { Bone, DASH, Eyebrow } from '../primitives';

type Tab = 'depositors' | 'activity' | 'mine';
const DEPOSITOR_PAGE = 20;
const TH = 'h-9 px-2 sm:px-4';
const TD = 'px-2 py-2.5 sm:px-4';

const KIND: Record<VaultEventKind, { label: string; inflow: boolean }> = {
  pre_deposit: { label: 'Deposit', inflow: true },
  pre_withdraw: { label: 'Withdraw', inflow: false },
  deposit_requested: { label: 'Deposit requested', inflow: true },
  deposit_cancelled: { label: 'Deposit cancelled', inflow: false },
  deposit_claimed: { label: 'Deposit settled', inflow: true },
  withdraw_requested: { label: 'Withdrawal requested', inflow: false },
  withdraw_cancelled: { label: 'Withdrawal cancelled', inflow: true },
  withdraw_claimed: { label: 'Withdrawal paid', inflow: false },
  terminal_redeemed: { label: 'Redeemed', inflow: false },
};

export function ActivityPanel({ vault }: { vault: Vault }) {
  const wallet = useWalletAddress();
  const [tab, setTab] = useState<Tab>('depositors');
  const active = tab === 'mine' && !wallet ? 'depositors' : tab;

  return (
    <section className="flex flex-col border border-outline">
      <div className="flex items-center border-b border-outline bg-card px-3 py-1.5 sm:px-4">
        <TabStrip
          id="vault-activity"
          active={active}
          className="-mb-1.5 flex overflow-x-auto"
          role="tablist"
        >
          <TabStripItem
            value="depositors"
            onSelect={() => setTab('depositors')}
            className="h-9 gap-2"
          >
            Depositors
            <span className="font-mono text-[11px] tabular-nums text-rock/45">
              {vault.depositors}
            </span>
          </TabStripItem>
          <TabStripItem value="activity" onSelect={() => setTab('activity')} className="h-9">
            Deposits &amp; withdrawals
          </TabStripItem>
          {wallet && (
            <TabStripItem value="mine" onSelect={() => setTab('mine')} className="h-9">
              Your activity
            </TabStripItem>
          )}
        </TabStrip>
      </div>
      {active === 'depositors' ? (
        <Depositors vault={vault} wallet={wallet} />
      ) : (
        <Activity key={active} vault={vault} wallet={active === 'mine' ? wallet : undefined} />
      )}
    </section>
  );
}

function Depositors({ vault, wallet }: { vault: Vault; wallet?: string }) {
  const [page, setPage] = useState(0);
  const q = useVaultDepositors(vault.network, vault.address, page, DEPOSITOR_PAGE);
  const rows = q.data?.depositors ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / DEPOSITOR_PAGE));

  if (q.isError) return <Empty title="Couldn’t load depositors" body="Try again in a moment." />;
  if (!q.isPending && rows.length === 0)
    return <Empty title="No depositors yet" body="Be the first to deposit into this vault." />;

  return (
    <>
      <Table className="min-w-[40rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={TH}>
              <Eyebrow>Depositor</Eyebrow>
            </TableHead>
            <TableHead className={cn(TH, 'text-right')}>
              <Eyebrow>Equity</Eyebrow>
            </TableHead>
            <TableHead className={cn(TH, 'text-right')}>
              <Eyebrow>Shares</Eyebrow>
            </TableHead>
            <TableHead className={cn(TH, 'text-right')}>
              <Eyebrow>All-time PnL</Eyebrow>
            </TableHead>
            <TableHead className={cn(TH, 'text-right')}>
              <Eyebrow>Pending</Eyebrow>
            </TableHead>
            <TableHead className={cn(TH, 'hidden text-right md:table-cell')}>
              <Eyebrow>Since</Eyebrow>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isPending
            ? Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} cols={6} />)
            : rows.map(d => {
                const you = d.wallet === wallet;
                const pending =
                  d.pending_deposit > 0
                    ? `+${usd(d.pending_deposit)}`
                    : d.pending_withdraw_shares > 0
                      ? `−${num(d.pending_withdraw_shares)} sh`
                      : null;
                return (
                  <TableRow
                    key={d.wallet}
                    aria-current={you ? 'true' : undefined}
                    className={cn(
                      you && 'bg-amber-200/[0.05] shadow-[inset_2px_0_0_var(--color-amber-200)]'
                    )}
                  >
                    <TableCell className={TD}>
                      <div className="flex items-center gap-2.5">
                        <AccountAvatar address={d.wallet} className="size-5" />
                        <span className="font-mono text-xs text-rock/85" title={d.wallet}>
                          {shortAddress(d.wallet)}
                        </span>
                        {you && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200">
                            You
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(TD, 'text-right font-mono text-xs tabular-nums text-rock')}
                    >
                      {usd(d.equity)}
                    </TableCell>
                    <TableCell
                      className={cn(TD, 'text-right font-mono text-xs tabular-nums text-rock/70')}
                    >
                      {num(d.shares)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        TD,
                        'text-right font-mono text-xs tabular-nums',
                        tone(d.all_time_pnl)
                      )}
                    >
                      {usdSigned(d.all_time_pnl)}
                    </TableCell>
                    <TableCell
                      className={cn(TD, 'text-right font-mono text-xs tabular-nums text-rock/70')}
                    >
                      {pending ?? DASH}
                    </TableCell>
                    <TableCell
                      className={cn(
                        TD,
                        'hidden text-right font-mono text-xs text-rock/55 md:table-cell'
                      )}
                    >
                      {d.first_deposit_at_ms ? formatDateTime(d.first_deposit_at_ms / 1000) : DASH}
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
      {pages > 1 && (
        <Pager page={page} pages={pages} total={total} size={DEPOSITOR_PAGE} onPage={setPage} />
      )}
    </>
  );
}

function Activity({ vault, wallet }: { vault: Vault; wallet?: string }) {
  const q = useVaultActivity(vault.network, vault.address, wallet);
  const events: VaultEvent[] = q.data?.pages.flatMap(p => p.events) ?? [];

  if (q.isError) return <Empty title="Couldn’t load activity" body="Try again in a moment." />;
  if (!q.isPending && events.length === 0)
    return wallet ? (
      <Empty
        title="No activity from this wallet"
        body="Your deposits and withdrawals will show up here."
      />
    ) : (
      <Empty title="No activity yet" body="Deposits and withdrawals will show up here." />
    );

  return (
    <>
      <Table className="min-w-[40rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={TH}>
              <Eyebrow>Time</Eyebrow>
            </TableHead>
            <TableHead className={TH}>
              <Eyebrow>Action</Eyebrow>
            </TableHead>
            <TableHead className={TH}>
              <Eyebrow>Wallet</Eyebrow>
            </TableHead>
            <TableHead className={cn(TH, 'text-right')}>
              <Eyebrow>Amount</Eyebrow>
            </TableHead>
            <TableHead className={cn(TH, 'text-right')}>
              <Eyebrow>Shares</Eyebrow>
            </TableHead>
            <TableHead className={cn(TH, 'w-12 text-right')}>
              <Eyebrow>Tx</Eyebrow>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isPending
            ? Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} cols={6} />)
            : events.map(e => {
                const k = KIND[e.kind];
                return (
                  <TableRow key={`${e.signature}:${e.event_index}`}>
                    <TableCell className={cn(TD, 'font-mono text-xs text-rock/60')}>
                      {formatDateTime(e.time_ms / 1000)}
                    </TableCell>
                    <TableCell className={cn(TD, 'text-xs')}>
                      <span className={k.inflow ? 'text-success' : 'text-rock/85'}>{k.label}</span>
                    </TableCell>
                    <TableCell className={cn(TD, 'font-mono text-xs text-rock/70')}>
                      {e.wallet ? <span title={e.wallet}>{shortAddress(e.wallet)}</span> : DASH}
                    </TableCell>
                    <TableCell
                      className={cn(TD, 'text-right font-mono text-xs tabular-nums text-rock')}
                    >
                      {e.amount === null ? DASH : usd(e.amount)}
                    </TableCell>
                    <TableCell
                      className={cn(TD, 'text-right font-mono text-xs tabular-nums text-rock/70')}
                    >
                      {e.shares === null ? DASH : num(e.shares)}
                    </TableCell>
                    <TableCell className={cn(TD, 'text-right')}>
                      <a
                        href={explorerTxUrl(e.signature, vault.network)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View transaction"
                        className="inline-flex text-rock/40 hover:text-rock"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
      {q.hasNextPage && (
        <div className="flex justify-center border-t border-outline px-3 py-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  );
}

function Pager({
  page,
  pages,
  total,
  size,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  size: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-outline px-3 py-2 sm:px-4">
      <Eyebrow className="tabular-nums">
        {page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}
      </Eyebrow>
      <Button
        variant="outline"
        size="icon"
        className="size-7"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-7"
        aria-label="Next page"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
      <p className="text-sm text-rock/75">{title}</p>
      <p className="text-xs text-rock/45">{body}</p>
    </div>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      {Array.from({ length: cols }, (_, i) => (
        <TableCell key={i} className={TD}>
          <Bone className={cn('h-3.5', i === 0 ? 'w-28' : 'ml-auto w-16')} />
        </TableCell>
      ))}
    </TableRow>
  );
}
