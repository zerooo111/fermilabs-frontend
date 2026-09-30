/**
 * Every vault in one sortable table. On phones the rows turn into cards.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronRight, Search } from 'lucide-react';

import { Input } from '@/shared/ui/input';
import { Eyebrow, FOCUS_RING, Panel } from '@/shared/ui/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { cn } from '@/lib/utils';

import { pct, pctSigned, shortAddress, tone, usd, usdCompact } from '../../model/format';
import { sliceHistory } from '../../model/range';
import type { Vault } from '../../model/types';
import { Sparkline } from '../Sparkline';
import { StatusBadge } from '../VaultBadges';
import { VaultMark } from '../VaultMark';

type Filter = 'all' | 'protocol' | 'community' | 'mine';
const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  protocol: 'Official',
  community: 'Community',
  mine: 'My deposits',
};

type SortKey = 'apr' | 'tvl' | 'allTime' | 'deposit';

const SORT_LABEL: Record<SortKey, string> = {
  apr: 'APR',
  tvl: 'Total deposits',
  allTime: 'Return',
  deposit: 'Your deposit',
};

const SORT_VALUE: Record<SortKey, (v: Vault) => number> = {
  apr: v => v.apr30d,
  tvl: v => v.tvl,
  allTime: v => v.allTimeReturn,
  deposit: v => v.user?.equity ?? -1,
};

export function VaultsTable({ vaults }: { vaults: Vault[] }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'tvl', desc: true });

  const counts = useMemo(
    () => ({
      all: vaults.length,
      protocol: vaults.filter(v => v.kind === 'protocol').length,
      community: vaults.filter(v => v.kind === 'community').length,
      mine: vaults.filter(v => v.user).length,
    }),
    [vaults]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const get = SORT_VALUE[sort.key];
    return vaults
      .filter(v => {
        if (filter === 'protocol' && v.kind !== 'protocol') return false;
        if (filter === 'community' && v.kind !== 'community') return false;
        if (filter === 'mine' && !v.user) return false;
        if (!q) return true;
        return (
          v.name.toLowerCase().includes(q) ||
          v.leader.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (sort.desc ? get(b) - get(a) : get(a) - get(b)));
  }, [vaults, filter, query, sort]);

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  return (
    <Panel>
      {/* Controls */}
      <div className="flex flex-col gap-3 border-b border-line-subtle bg-surface-raised md:flex-row md:items-center md:justify-between md:pr-3">
        <Tabs value={filter} onValueChange={v => setFilter(v as Filter)}>
          <TabsList className="h-11 w-full justify-start overflow-x-auto md:w-auto">
            {(['all', 'protocol', 'community', 'mine'] as const).map(f => (
              <TabsTrigger key={f} value={f} className="gap-2">
                {FILTER_LABEL[f]}
                <span className="font-mono text-[10px] tabular-nums text-fg-tertiary">
                  {counts[f]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 px-3 pb-3 md:p-0">
          <div className="relative flex-1 md:w-64 md:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-tertiary" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search vaults"
              aria-label="Search vaults"
              className={cn('h-8 pl-8 text-xs', FOCUS_RING)}
            />
          </div>
          <Select value={sort.key} onValueChange={v => setSort({ key: v as SortKey, desc: true })}>
            <SelectTrigger size="sm" className="md:hidden" aria-label="Sort vaults">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortKey[]).map(k => (
                <SelectItem key={k} value={k}>
                  {SORT_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-14 text-center">
          <span className="text-sm text-fg-primary">
            {filter === 'mine' ? 'You have no vault deposits yet' : 'No vaults match that search'}
          </span>
          <span className="text-xs text-fg-secondary">
            {filter === 'mine'
              ? 'Vaults you deposit into will show up here.'
              : 'Try another vault name.'}
          </span>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <Table containerClassName="hidden md:block">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">
                  <Eyebrow>Vault</Eyebrow>
                </TableHead>
                <SortHead k="apr" sort={sort} onSort={toggleSort}>
                  APR
                </SortHead>
                <SortHead k="tvl" sort={sort} onSort={toggleSort}>
                  Deposits
                </SortHead>
                <SortHead k="allTime" sort={sort} onSort={toggleSort}>
                  Return
                </SortHead>
                <SortHead k="deposit" sort={sort} onSort={toggleSort}>
                  Your deposit
                </SortHead>
                <TableHead className="hidden text-right lg:table-cell">
                  <Eyebrow>30D</Eyebrow>
                </TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(v => (
                <TableRow
                  key={v.id}
                  onClick={() => navigate(`/vaults/${v.id}`)}
                  className="group cursor-pointer"
                >
                  <TableCell className="py-2.5 pl-4">
                    <div className="flex items-center gap-3">
                      <VaultMark vault={v} />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/vaults/${v.id}`}
                            onClick={e => e.stopPropagation()}
                            className={cn(
                              'truncate text-sm font-medium text-fg-primary',
                              FOCUS_RING
                            )}
                          >
                            {v.name}
                          </Link>
                          <StatusBadge status={v.status} />
                        </div>
                        <span className="font-mono text-[11px] text-fg-tertiary">
                          {v.kind === 'protocol'
                            ? 'Managed by Fermi'
                            : `Managed by ${shortAddress(v.leader)}`}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn('font-mono text-sm font-semibold tabular-nums', tone(v.apr30d))}
                    >
                      {pct(v.apr30d, 1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm tabular-nums text-fg-primary">
                      {usdCompact(v.tvl)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn('font-mono text-sm tabular-nums', tone(v.allTimeReturn))}>
                      {pctSigned(v.allTimeReturn, 1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {v.user ? (
                      <span className="font-mono text-sm tabular-nums text-fg-primary">
                        {usd(v.user.equity)}
                      </span>
                    ) : (
                      <span className="text-fg-disabled">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Sparkline
                      className="ml-auto"
                      values={sliceHistory(v.history, '30D').map(p => p.sharePrice)}
                    />
                  </TableCell>
                  <TableCell className="pr-3">
                    <ChevronRight className="size-4 text-fg-disabled transition-colors group-hover:text-fg-primary" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Mobile cards */}
          <ul className="flex flex-col divide-y divide-line-subtle md:hidden">
            {rows.map(v => (
              <li key={v.id}>
                <Link
                  to={`/vaults/${v.id}`}
                  className={cn('flex flex-col gap-3 p-4 active:bg-state-pressed', FOCUS_RING)}
                >
                  <div className="flex items-center gap-3">
                    <VaultMark vault={v} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-fg-primary">{v.name}</span>
                      <span className="font-mono text-[11px] text-fg-tertiary">
                        {v.kind === 'protocol'
                          ? 'Managed by Fermi'
                          : `Managed by ${shortAddress(v.leader)}`}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span
                        className={cn(
                          'font-mono text-lg font-semibold tabular-nums',
                          tone(v.apr30d)
                        )}
                      >
                        {pct(v.apr30d, 1)}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-tertiary">
                        APR
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <dl className="grid grid-cols-3 gap-4">
                      <MiniStat label="Deposits" value={usdCompact(v.tvl)} />
                      <MiniStat
                        label="Return"
                        value={pctSigned(v.allTimeReturn, 1)}
                        className={tone(v.allTimeReturn)}
                      />
                      <MiniStat label="Yours" value={v.user ? usdCompact(v.user.equity) : '-'} />
                    </dl>
                    <Sparkline
                      width={80}
                      height={28}
                      values={sliceHistory(v.history, '30D').map(p => p.sharePrice)}
                    />
                  </div>
                  <StatusBadge status={v.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
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
      className={cn('text-right', className)}
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          'inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors',
          active ? 'text-fg-primary' : 'text-fg-tertiary hover:text-fg-primary',
          FOCUS_RING
        )}
      >
        <Icon className={cn('size-3', !active && 'opacity-0')} />
        {children}
      </button>
    </TableHead>
  );
}

function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-tertiary">
        {label}
      </dt>
      <dd className={cn('font-mono text-xs tabular-nums text-fg-primary', className)}>{value}</dd>
    </div>
  );
}
