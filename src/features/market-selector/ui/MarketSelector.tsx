/**
 * Market selector
 * Trigger in the chart header that opens a searchable market table with
 * live stats, favourites and keyboard control (⌘K open, ↑↓ move, Enter pick,
 * ⌘S favourite, Esc close).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue } from 'jotai';
import { CaretDown, CaretUp, MagnifyingGlass, Star } from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { cn } from '@/lib/utils';
import { marketsAtom, MarketKind } from '@/entities/market';
import { useMarketSummaries, type MarketSummary } from '../model/useMarketSummaries';
import { favoriteMarketIdsAtom } from '../model/favorites';
import { Sparkline } from './Sparkline';

interface MarketSelectorProps {
  selectedMarketId: string | null;
  onMarketSelect: (marketId: string) => void;
  isLoading: boolean;
  marketKind?: MarketKind; // Optional filter for market type
}

type Tab = 'all' | 'favorites';
type SortKey =
  | 'symbol'
  | 'markPrice'
  | 'change24hPct'
  | 'fundingHourly'
  | 'volume24hUsd'
  | 'openInterestUsd';

const COLUMNS: Array<{ key: SortKey; label: string; className: string }> = [
  { key: 'symbol', label: 'Market', className: 'text-left' },
  { key: 'markPrice', label: 'Last price', className: 'text-right' },
  { key: 'change24hPct', label: '24h change', className: 'text-right' },
  { key: 'fundingHourly', label: '1h funding', className: 'text-right hidden md:table-cell' },
  { key: 'volume24hUsd', label: '24h volume', className: 'text-right hidden sm:table-cell' },
  { key: 'openInterestUsd', label: 'Open interest', className: 'text-right hidden md:table-cell' },
];

function fmtPrice(value: number | null): string {
  if (value === null) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 10 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 8;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtUsd(value: number | null): string {
  if (value === null) return '—';
  return `$${value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
}

function fmtSigned(value: number, text: string): string {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${text}`;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border border-outline px-1.5 font-mono text-[10px] leading-4 text-rock/70">
      {children}
    </kbd>
  );
}

function MarketSelectorBase({
  selectedMarketId,
  onMarketSelect,
  isLoading,
  marketKind,
}: MarketSelectorProps) {
  const allMarkets = useAtomValue(marketsAtom);
  const markets = useMemo(
    () => (marketKind ? allMarkets.filter(m => m.kind === marketKind) : allMarkets),
    [allMarkets, marketKind]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'volume24hUsd',
    desc: true,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useAtom(favoriteMarketIdsAtom);
  const listRef = useRef<HTMLTableSectionElement>(null);

  const { summaries } = useMarketSummaries(markets, open);
  const selected = summaries.find(s => s.id === selectedMarketId);

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    const filtered = summaries.filter(
      s =>
        (tab === 'all' || favorites.includes(s.id)) &&
        (!q || s.symbol.includes(q) || s.base.includes(q))
    );
    const dir = sort.desc ? -1 : 1;
    return filtered.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      // Missing values always sink to the bottom
      if (av === null) return 1;
      if (bv === null) return -1;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [summaries, query, tab, favorites, sort]);

  // Reset the cursor whenever the visible list changes shape
  useEffect(() => setActiveIndex(0), [query, tab, sort]);

  // ⌘K / Ctrl+K toggles the selector from anywhere on the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const toggleFavorite = useCallback(
    (id: string) =>
      setFavorites(prev => (prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])),
    [setFavorites]
  );

  const pick = useCallback(
    (id: string) => {
      onMarketSelect(id);
      setOpen(false);
    },
    [onMarketSelect]
  );

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  }, []);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const row = rows[activeIndex];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && row) {
      e.preventDefault();
      pick(row.id);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && row) {
      e.preventDefault();
      toggleFavorite(row.id);
    }
  };

  const onSort = (key: SortKey) =>
    setSort(prev => ({ key, desc: prev.key === key ? !prev.desc : key !== 'symbol' }));

  const triggerLabel = selected?.symbol ?? markets.find(m => m.uuid === selectedMarketId)?.name;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {/* Scrim like the modal's, lighter, so the table lifts off the page.
          Below the popover (z-50); a click on it closes via outside-click. */}
      {open &&
        createPortal(
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
          />,
          document.body
        )}
      <PopoverTrigger
        disabled={isLoading || markets.length === 0}
        aria-label="Select market"
        className="flex h-12 items-center gap-2 px-3 text-rock transition-colors hover:bg-white/5 disabled:opacity-50 data-[state=open]:bg-white/5"
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-sm text-rock/60">
            <Loader2 className="size-4 animate-spin" />
            Loading
          </span>
        ) : (
          <>
            <span className="text-lg font-medium whitespace-nowrap">
              {triggerLabel ?? 'Select market'}
            </span>
            {selected && (
              <span className="border border-outline px-1 font-mono text-xs leading-4 text-rock/80">
                {selected.maxLeverage}×
              </span>
            )}
            {open ? (
              <CaretUp size={12} className="text-rock/60" />
            ) : (
              <CaretDown size={12} className="text-rock/60" />
            )}
          </>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={0}
        onOpenAutoFocus={e => e.preventDefault()}
        className="flex w-[min(56rem,calc(100vw-2rem))] flex-col border-rock/25 bg-background p-0 text-rock shadow-2xl shadow-black/60 backdrop-blur-none"
      >
        {/* Search */}
        <div className="flex items-center gap-2 border-b border-outline px-3">
          <MagnifyingGlass size={14} className="shrink-0 text-rock/50" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search markets"
            aria-label="Search markets"
            className="h-10 w-full bg-transparent text-sm text-rock outline-none placeholder:text-rock/40"
          />
        </div>

        {/* Tabs */}
        <div role="tablist" className="flex items-end gap-1 border-b border-outline px-3 pt-2">
          {(['all', 'favorites'] as const).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm leading-5 capitalize transition-colors first:pl-0',
                tab === t
                  ? 'border-rock text-rock'
                  : 'border-transparent text-rock/50 hover:text-rock'
              )}
            >
              {t}
              {t === 'favorites' && favorites.length > 0 && (
                <span className="font-mono text-[11px] text-rock/50">{favorites.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="text-xs text-rock/50">
                {COLUMNS.map((col, i) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      sort.key === col.key ? (sort.desc ? 'descending' : 'ascending') : undefined
                    }
                    className={cn('h-8 px-2 font-normal whitespace-nowrap sm:px-3', col.className)}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors hover:text-rock',
                        i === 0 && 'pl-6',
                        sort.key === col.key && 'text-rock'
                      )}
                    >
                      {col.label}
                      {sort.key === col.key &&
                        (sort.desc ? <CaretDown size={10} /> : <CaretUp size={10} />)}
                    </button>
                  </th>
                ))}
                <th scope="col" className="hidden h-8 px-3 text-right font-normal lg:table-cell">
                  24h trend
                </th>
              </tr>
            </thead>
            <tbody ref={listRef}>
              {rows.map((row, index) => (
                <MarketRow
                  key={row.id}
                  row={row}
                  index={index}
                  active={index === activeIndex}
                  current={row.id === selectedMarketId}
                  favorite={favorites.includes(row.id)}
                  onHover={setActiveIndex}
                  onPick={pick}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-rock/50">
              {tab === 'favorites' && !query
                ? 'No favourites yet. Star a market to pin it here.'
                : `No markets match “${query}”.`}
            </p>
          )}
        </div>

        {/* Shortcuts */}
        <div className="hidden items-center gap-4 border-t border-outline px-3 py-2 text-[11px] text-rock/50 md:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>⌘K</Kbd> Open
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↑↓</Kbd> Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd> Select
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>⌘S</Kbd> Favourite
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd> Close
          </span>
          <span className="ml-auto font-mono">
            {rows.length} of {summaries.length} markets
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface MarketRowProps {
  row: MarketSummary;
  index: number;
  active: boolean;
  current: boolean;
  favorite: boolean;
  onHover: (index: number) => void;
  onPick: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

const MarketRow = memo(function MarketRow({
  row,
  index,
  active,
  current,
  favorite,
  onHover,
  onPick,
  onToggleFavorite,
}: MarketRowProps) {
  const change = row.change24h;
  const changeTone =
    change === null || change === 0 ? 'text-rock/70' : change > 0 ? 'text-success' : 'text-danger';

  return (
    <tr
      data-index={index}
      aria-selected={active}
      onMouseMove={() => onHover(index)}
      onClick={() => onPick(row.id)}
      className={cn('h-10 cursor-pointer transition-colors', active && 'bg-white/5')}
    >
      <td className="px-2 sm:px-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={
              favorite ? `Remove ${row.symbol} from favourites` : `Add ${row.symbol} to favourites`
            }
            aria-pressed={favorite}
            onClick={e => {
              e.stopPropagation();
              onToggleFavorite(row.id);
            }}
            className={cn(
              'transition-colors',
              favorite ? 'text-amber-200' : 'text-rock/30 hover:text-rock/70'
            )}
          >
            <Star size={14} weight={favorite ? 'fill' : 'regular'} />
          </button>
          <span
            className={cn(
              'font-medium whitespace-nowrap',
              current ? 'text-amber-200' : 'text-rock'
            )}
          >
            {row.symbol}
          </span>
          <span className="hidden border border-outline px-1 font-mono text-[11px] leading-4 text-rock/70 sm:inline">
            {row.maxLeverage}×
          </span>
        </div>
      </td>
      <td className="px-2 text-right font-mono sm:px-3">{fmtPrice(row.markPrice)}</td>
      <td className={cn('px-2 text-right font-mono whitespace-nowrap sm:px-3', changeTone)}>
        {change === null || row.change24hPct === null ? (
          '—'
        ) : (
          <>
            {/* "+24.40 (+0.91%)"; just the percent on narrow screens */}
            <span className="hidden lg:inline">
              {fmtSigned(change, fmtPrice(Math.abs(change)))} (
            </span>
            {fmtSigned(change, `${Math.abs(row.change24hPct).toFixed(2)}%`)}
            <span className="hidden lg:inline">)</span>
          </>
        )}
      </td>
      <td className="hidden px-3 text-right font-mono text-rock/80 md:table-cell">
        {row.fundingHourly === null ? '—' : `${row.fundingHourly.toFixed(4)}%`}
      </td>
      <td className="hidden px-3 text-right font-mono text-rock/80 sm:table-cell">
        {fmtUsd(row.volume24hUsd)}
      </td>
      <td className="hidden px-3 text-right font-mono text-rock/80 md:table-cell">
        {fmtUsd(row.openInterestUsd)}
      </td>
      <td className="hidden px-3 lg:table-cell">
        <div className="flex justify-end">
          <Sparkline values={row.sparkline} positive={(change ?? 0) >= 0} />
        </div>
      </td>
    </tr>
  );
});

export const MarketSelector = memo(MarketSelectorBase);
