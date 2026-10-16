/**
 * One section of the listing (protocol or community vaults) as a sortable
 * table. Rows open the vault. On phones the rows turn into cards. Long lists
 * page client-side; the gateway already returns every vault.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { FOCUS_RING } from '@/shared/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

import type { Vault, VaultWindow } from '../../api/vaultsClient';
import { apr, shortAddress, tone, usd, usdCompact } from '../../model/format';
import { vaultHref } from '../../model/params';
import { Sparkline } from '../Sparkline';
import { ModeBadge, NetworkBadge } from '../VaultBadges';
import { VaultMark } from '../VaultMark';
import { Bone, DASH, Eyebrow, PanelBar } from '../primitives';

type SortKey = 'apr' | 'tvl' | 'deposit' | 'age';
const SORT_VALUE: Record<SortKey, (v: Vault) => number> = {
  apr: v => v.apr ?? -Infinity,
  tvl: v => v.tvl,
  deposit: v => v.user?.equity ?? -1,
  age: v => v.age_days,
};
const PAGE_SIZE = 10;

const TH = 'h-9 px-2 sm:px-4';
const TD = 'px-2 py-2.5 sm:px-4';

export function VaultsTable({
  title,
  vaults,
  window,
  loading,
  empty,
}: {
  title: string;
  vaults: Vault[];
  window: VaultWindow;
  loading: boolean;
  empty: { title: string; body: string };
}) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'tvl', desc: true });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const get = SORT_VALUE[sort.key];
    // Closed vaults sink below open ones whatever the sort.
    return [...vaults].sort(
      (a, b) =>
        Number(a.mode === 'closed') - Number(b.mode === 'closed') ||
        (sort.desc ? get(b) - get(a) : get(a) - get(b))
    );
  }, [vaults, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const windowLabel = window === 'all' ? 'All' : window.toUpperCase();

  const toggle = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  return (
    <section className="flex flex-col border border-outline">
      <PanelBar title={title} count={loading ? undefined : vaults.length} />

      {!loading && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
          <p className="text-sm text-rock/75">{empty.title}</p>
          <p className="max-w-sm text-xs text-rock/45">{empty.body}</p>
        </div>
      ) : (
        <>
          <Table containerClassName="hidden md:block" className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(TH, 'w-[34%]')}>
                  <Eyebrow>Vault</Eyebrow>
                </TableHead>
                <TableHead className={cn(TH, 'hidden w-[12%] lg:table-cell')}>
                  <Eyebrow>Leader</Eyebrow>
                </TableHead>
                <SortHead k="apr" sort={sort} onSort={toggle}>
                  APR · {windowLabel}
                </SortHead>
                <SortHead k="tvl" sort={sort} onSort={toggle}>
                  TVL
                </SortHead>
                <SortHead k="deposit" sort={sort} onSort={toggle}>
                  Your deposit
                </SortHead>
                <SortHead k="age" sort={sort} onSort={toggle} className="hidden xl:table-cell">
                  Age
                </SortHead>
                <TableHead className={cn(TH, 'hidden w-40 text-right lg:table-cell')}>
                  <Eyebrow>Trend · {windowLabel}</Eyebrow>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 2 }, (_, i) => <SkeletonRow key={i} />)
                : shown.map(v => (
                    <TableRow
                      key={`${v.network}:${v.address}`}
                      onClick={() => navigate(vaultHref(v))}
                      className={cn('group cursor-pointer', v.mode === 'closed' && 'opacity-60')}
                    >
                      <TableCell className={TD}>
                        <div className="flex min-w-0 items-center gap-3">
                          <VaultMark vault={v} size="sm" />
                          <div className="flex min-w-0 flex-col gap-1">
                            <Link
                              to={vaultHref(v)}
                              onClick={e => e.stopPropagation()}
                              className={cn(
                                'truncate text-sm text-rock group-hover:text-amber-100',
                                FOCUS_RING
                              )}
                            >
                              {v.name}
                            </Link>
                            <div className="flex items-center gap-1.5">
                              <NetworkBadge network={v.network} />
                              <ModeBadge mode={v.mode} />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={cn(TD, 'hidden lg:table-cell')}>
                        <span className="font-mono text-xs text-rock/60" title={v.leader}>
                          {v.kind === 'protocol' ? 'Fermi' : shortAddress(v.leader)}
                        </span>
                      </TableCell>
                      <TableCell className={cn(TD, 'text-right')}>
                        <span
                          className={cn(
                            'font-mono text-sm tabular-nums',
                            v.apr === null ? 'text-rock/40' : tone(v.apr)
                          )}
                          title={v.apr === null ? 'Needs a day of history' : undefined}
                        >
                          {apr(v.apr)}
                        </span>
                      </TableCell>
                      <TableCell className={cn(TD, 'text-right')}>
                        <span
                          className="font-mono text-sm tabular-nums text-rock"
                          title={usd(v.tvl)}
                        >
                          {usdCompact(v.tvl)}
                        </span>
                      </TableCell>
                      <TableCell className={cn(TD, 'text-right')}>
                        {v.user ? (
                          <span className="font-mono text-sm tabular-nums text-rock">
                            {usd(v.user.equity)}
                          </span>
                        ) : (
                          DASH
                        )}
                      </TableCell>
                      <TableCell className={cn(TD, 'hidden text-right xl:table-cell')}>
                        <span className="font-mono text-xs tabular-nums text-rock/60">
                          {v.age_days}d
                        </span>
                      </TableCell>
                      <TableCell className={cn(TD, 'hidden lg:table-cell')}>
                        <Sparkline
                          className="ml-auto"
                          width={112}
                          height={28}
                          values={(v.sparkline ?? []).map(p => p[1])}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>

          <ul className="flex flex-col divide-y divide-outline md:hidden">
            {loading
              ? Array.from({ length: 2 }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 p-4">
                    <Bone className="size-7" />
                    <Bone className="h-4 w-40" />
                  </li>
                ))
              : shown.map(v => <MobileRow key={`${v.network}:${v.address}`} vault={v} />)}
          </ul>

          {pages > 1 && (
            <div className="flex items-center justify-end gap-3 border-t border-outline px-3 py-2 sm:px-4">
              <Eyebrow className="tabular-nums">
                {current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} of{' '}
                {rows.length}
              </Eyebrow>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                aria-label="Next page"
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MobileRow({ vault: v }: { vault: Vault }) {
  return (
    <li>
      <Link
        to={vaultHref(v)}
        className={cn(
          'flex flex-col gap-3 p-4 active:bg-rock/5',
          v.mode === 'closed' && 'opacity-60',
          FOCUS_RING
        )}
      >
        <div className="flex items-center gap-3">
          <VaultMark vault={v} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm text-rock">{v.name}</span>
            <div className="flex items-center gap-1.5">
              <NetworkBadge network={v.network} />
              <ModeBadge mode={v.mode} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span
              className={cn(
                'font-mono text-base tabular-nums',
                v.apr === null ? 'text-rock/40' : tone(v.apr)
              )}
            >
              {apr(v.apr)}
            </span>
            <Eyebrow className="text-[10px]">APR</Eyebrow>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <dl className="grid grid-cols-2 gap-6">
            <MiniStat label="TVL" value={usdCompact(v.tvl)} />
            <MiniStat label="Yours" value={v.user ? usdCompact(v.user.equity) : '—'} />
          </dl>
          <Sparkline width={88} height={26} values={(v.sparkline ?? []).map(p => p[1])} />
        </div>
      </Link>
    </li>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt>
        <Eyebrow className="text-[10px]">{label}</Eyebrow>
      </dt>
      <dd className="font-mono text-xs tabular-nums text-rock">{value}</dd>
    </div>
  );
}

function SkeletonRow() {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className={TD}>
        <div className="flex items-center gap-3">
          <Bone className="size-7" />
          <div className="flex flex-col gap-1.5">
            <Bone className="h-3.5 w-44" />
            <Bone className="h-3 w-24" />
          </div>
        </div>
      </TableCell>
      <TableCell className={cn(TD, 'hidden lg:table-cell')}>
        <Bone className="h-3 w-14" />
      </TableCell>
      {[0, 1, 2].map(i => (
        <TableCell key={i} className={TD}>
          <Bone className="ml-auto h-3.5 w-16" />
        </TableCell>
      ))}
      <TableCell className={cn(TD, 'hidden xl:table-cell')}>
        <Bone className="ml-auto h-3 w-8" />
      </TableCell>
      <TableCell className={cn(TD, 'hidden lg:table-cell')}>
        <Bone className="ml-auto h-7 w-28" />
      </TableCell>
    </TableRow>
  );
}

function SortHead({
  k,
  sort,
  onSort,
  className,
  children,
}: {
  k: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (k: SortKey) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = sort.key === k;
  const Icon = sort.desc ? ArrowDown : ArrowUp;
  return (
    <TableHead
      className={cn(TH, 'text-right', className)}
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          'inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors',
          active ? 'text-rock/85' : 'text-rock/50 hover:text-rock/85',
          FOCUS_RING
        )}
      >
        <Icon className={cn('size-3', !active && 'opacity-0')} />
        {children}
      </button>
    </TableHead>
  );
}
