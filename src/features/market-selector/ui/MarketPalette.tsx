/**
 * Market palette: a centred, keyboard-first market switcher (⌘K / Ctrl+K).
 *
 * Left, a searchable, sortable table of every perp with a 24h sparkline.
 * Right, a live preview of the highlighted market so you can compare before
 * you jump. ↑↓ move, Enter trades, ⌘S stars, Esc closes. Favourites are kept
 * in this browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CaretDown,
  MagnifyingGlass,
  Star,
} from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { useSelectedMarket } from '@/entities/market';

import { type MarketOverview, useMarketsOverview } from '../model/useMarketsOverview';
import { Sparkline } from './Sparkline';

type SortKey = 'volume24h' | 'price' | 'change24h' | 'funding' | 'openInterest';
type Tab = 'all' | 'favorites';

const FAVORITES_KEY = 'fermi.markets.favorites';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

// ---------------------------------------------------------------- formatting

const fmtPrice = (n: number | null) => {
  if (n === null) return '—';
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 3 : abs >= 0.01 ? 5 : 7;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};
const fmtUsd = (n: number | null) =>
  n === null
    ? '—'
    : `$${n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })}`;
const fmtPct = (n: number | null, digits = 2) =>
  n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
const tone = (n: number | null) =>
  n === null || n === 0 ? 'text-fg-secondary' : n > 0 ? 'text-positive-fg' : 'text-negative-fg';

// ---------------------------------------------------------------- favourites

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const toggle = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // ignore: favourites just won't persist
      }
      return next;
    });
  }, []);
  return [favorites, toggle] as const;
}

// ---------------------------------------------------------------- pieces

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center border border-[var(--glass-control)] px-1 font-mono text-[10px] text-fg-secondary">
      {children}
    </kbd>
  );
}

function LeverageBadge({ value }: { value: number }) {
  return (
    <span className="bg-state-selected px-1 py-px font-mono text-[10px] text-fg-secondary">
      {value}×
    </span>
  );
}

const COLUMNS: { key: SortKey | null; label: string; className: string }[] = [
  { key: null, label: 'Market', className: 'text-left' },
  { key: 'price', label: 'Price', className: 'text-right' },
  { key: 'change24h', label: '24h', className: 'text-right' },
  { key: 'funding', label: 'Funding 1h', className: 'text-right hidden lg:block' },
  { key: 'volume24h', label: 'Volume', className: 'text-right' },
  { key: 'openInterest', label: 'Open int.', className: 'text-right hidden sm:block' },
];
const GRID =
  'grid grid-cols-[minmax(150px,1.8fr)_1fr_0.8fr_0.9fr] sm:grid-cols-[minmax(170px,1.8fr)_1fr_0.8fr_0.9fr_0.9fr] lg:grid-cols-[minmax(180px,1.8fr)_1fr_0.8fr_0.9fr_0.9fr_0.9fr] items-center gap-3';

function Preview({
  row,
  current,
  favorite,
  onToggleFavorite,
  onTrade,
}: {
  row: MarketOverview | undefined;
  current: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  onTrade: () => void;
}) {
  if (!row) {
    return (
      <div className="grid h-full place-items-center p-6 text-xs text-fg-tertiary">
        No market selected
      </div>
    );
  }
  const quote = row.market.quoteTokenName;
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-medium">{row.symbol}</span>
            <span className="text-xs text-fg-tertiary">{row.market.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <LeverageBadge value={row.maxLeverage} />
            {current && <span className="text-[11px] text-fg-tertiary">Trading now</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          className={cn(
            'grid size-8 place-items-center border border-[var(--glass-control)] transition-colors hover:bg-state-hover',
            favorite ? 'text-warning-fg' : 'text-fg-tertiary hover:text-fg-primary'
          )}
        >
          <Star size={14} weight={favorite ? 'fill' : 'regular'} />
        </button>
      </div>

      <div>
        <div className="font-mono text-3xl tabular-nums tracking-tight">{fmtPrice(row.price)}</div>
        <div className={cn('mt-1 font-mono text-sm tabular-nums', tone(row.change24h))}>
          {fmtPct(row.change24h)} <span className="text-fg-tertiary">24h</span>
        </div>
      </div>

      <div className="border border-[var(--glass-divider)] bg-state-hover p-2">
        <Sparkline
          values={row.spark}
          width={260}
          height={84}
          strokeWidth={1.5}
          className="w-full"
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        {[
          ['Funding 1h', fmtPct(row.funding, 4), tone(row.funding === null ? null : -row.funding)],
          ['24h volume', fmtUsd(row.volume24h), ''],
          ['Open interest', fmtUsd(row.openInterest), ''],
          ['Quote', quote, ''],
        ].map(([label, value, cls]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-fg-tertiary">{label}</dt>
            <dd className={cn('font-mono tabular-nums text-fg-primary', cls)}>{value}</dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={onTrade}
        className="mt-auto flex h-10 items-center justify-center gap-2 bg-surface-inverse text-sm font-medium text-fg-inverse transition-colors hover:bg-[var(--color-surface-inverse-hover)]"
      >
        {current ? `Back to ${row.symbol}` : `Trade ${row.symbol}`}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- palette

export function MarketPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedMarket, selectMarket } = useSelectedMarket();
  const rows = useMarketsOverview(open);
  const [favorites, toggleFavorite] = useFavorites();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'volume24h', dir: -1 });
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Fresh search each time; start on the market being traded
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTab('all');
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(r => tab === 'all' || favorites.has(r.market.uuid))
      .filter(
        r =>
          !q ||
          r.symbol.toLowerCase().includes(q) ||
          r.market.name.toLowerCase().includes(q) ||
          r.market.quoteTokenName.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const av = a[sort.key] ?? -Infinity;
        const bv = b[sort.key] ?? -Infinity;
        return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
      });
  }, [rows, query, tab, favorites, sort]);

  useEffect(() => {
    if (!open) return;
    const i = visible.findIndex(r => r.market.uuid === selectedMarket?.uuid);
    setActive(i >= 0 && !query ? i : 0);
    // Only when the list itself changes shape, not on every price tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, tab, sort, visible.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (row: MarketOverview | undefined) => {
    if (!row) return;
    selectMarket(row.market.uuid);
    onOpenChange(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(visible.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(visible[active]);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const row = visible[active];
      if (row) toggleFavorite(row.market.uuid);
    }
  };

  const activeRow = visible[active];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--color-scrim)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
          className="glass-surface fixed top-[10vh] left-1/2 z-50 flex max-h-[80vh] w-[min(960px,calc(100vw-32px))] -translate-x-1/2 flex-col outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-top-2"
        >
          <DialogPrimitive.Title className="sr-only">Switch market</DialogPrimitive.Title>

          {/* Search */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--glass-divider)] px-4">
            <MagnifyingGlass size={18} className="shrink-0 text-fg-tertiary" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search markets"
              aria-label="Search markets"
              className="min-w-0 flex-1 bg-transparent text-base text-fg-primary outline-none placeholder:text-fg-tertiary"
            />
            <Kbd>Esc</Kbd>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 items-center gap-1 border-b border-[var(--glass-divider)] px-3">
            {(
              [
                ['all', 'All markets', rows.length],
                ['favorites', 'Favorites', favorites.size],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px flex h-10 items-center gap-1.5 border-b-2 px-2 text-sm transition-colors',
                  tab === id
                    ? 'border-fg-primary text-fg-primary'
                    : 'border-transparent text-fg-tertiary hover:text-fg-primary'
                )}
              >
                {id === 'favorites' && <Star size={12} weight={tab === id ? 'fill' : 'regular'} />}
                {label}
                <span className="font-mono text-[11px] text-fg-tertiary">{count}</span>
              </button>
            ))}
          </div>

          {/* Body: list + preview */}
          <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-h-0 flex-col">
              <div
                className={cn(
                  GRID,
                  'shrink-0 px-4 py-2 text-[11px] text-fg-tertiary border-b border-[var(--glass-divider)]'
                )}
              >
                {COLUMNS.map(c =>
                  c.key ? (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() =>
                        setSort(s =>
                          s.key === c.key
                            ? { key: c.key!, dir: s.dir === 1 ? -1 : 1 }
                            : { key: c.key!, dir: -1 }
                        )
                      }
                      className={cn(
                        c.className,
                        'flex items-center gap-1 justify-end hover:text-fg-primary',
                        sort.key === c.key && 'text-fg-primary'
                      )}
                    >
                      {c.label}
                      {sort.key === c.key && (
                        <CaretDown size={10} className={cn(sort.dir === 1 && 'rotate-180')} />
                      )}
                    </button>
                  ) : (
                    <span key={c.label} className={c.className}>
                      {c.label}
                    </span>
                  )
                )}
              </div>

              <div
                ref={listRef}
                role="listbox"
                aria-label="Markets"
                className="min-h-0 flex-1 overflow-y-auto py-1"
              >
                {visible.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-fg-tertiary">
                    {tab === 'favorites' && !query ? (
                      <>
                        <Star size={20} />
                        No favorites yet. Star a market with {MOD}S or the star button.
                      </>
                    ) : (
                      <>No markets match “{query}”</>
                    )}
                  </div>
                ) : (
                  visible.map((r, i) => {
                    const isActive = i === active;
                    const isCurrent = r.market.uuid === selectedMarket?.uuid;
                    const fav = favorites.has(r.market.uuid);
                    return (
                      <div
                        key={r.market.uuid}
                        role="option"
                        aria-selected={isActive}
                        data-index={i}
                        onMouseMove={() => i !== active && setActive(i)}
                        onClick={() => choose(r)}
                        className={cn(
                          GRID,
                          'relative h-12 cursor-pointer px-4 text-sm transition-colors',
                          isActive ? 'bg-state-selected' : 'hover:bg-state-hover'
                        )}
                      >
                        {isCurrent && (
                          <span
                            className="absolute inset-y-2 left-0 w-0.5 bg-fg-primary"
                            aria-hidden
                          />
                        )}
                        <div className="flex min-w-0 items-center gap-2.5">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleFavorite(r.market.uuid);
                            }}
                            aria-label={fav ? `Unstar ${r.symbol}` : `Star ${r.symbol}`}
                            className={cn(
                              'shrink-0 transition-colors',
                              fav ? 'text-warning-fg' : 'text-fg-disabled hover:text-fg-primary'
                            )}
                          >
                            <Star size={14} weight={fav ? 'fill' : 'regular'} />
                          </button>
                          <span className="shrink-0 font-medium">{r.symbol}</span>
                          <LeverageBadge value={r.maxLeverage} />
                          <Sparkline
                            values={r.spark}
                            width={56}
                            height={20}
                            fill={false}
                            className="ml-auto hidden shrink-0 sm:block"
                          />
                        </div>
                        <span className="text-right font-mono tabular-nums">
                          {fmtPrice(r.price)}
                        </span>
                        <span
                          className={cn('text-right font-mono tabular-nums', tone(r.change24h))}
                        >
                          {fmtPct(r.change24h)}
                        </span>
                        <span className="hidden text-right font-mono tabular-nums text-fg-secondary lg:block">
                          {fmtPct(r.funding, 4)}
                        </span>
                        <span className="text-right font-mono tabular-nums text-fg-secondary">
                          {fmtUsd(r.volume24h)}
                        </span>
                        <span className="hidden text-right font-mono tabular-nums text-fg-secondary sm:block">
                          {fmtUsd(r.openInterest)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="hidden min-h-0 border-l border-[var(--glass-divider)] md:block">
              <Preview
                row={activeRow}
                current={activeRow?.market.uuid === selectedMarket?.uuid}
                favorite={!!activeRow && favorites.has(activeRow.market.uuid)}
                onToggleFavorite={() => activeRow && toggleFavorite(activeRow.market.uuid)}
                onTrade={() => choose(activeRow)}
              />
            </div>
          </div>

          {/* Keys */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--glass-divider)] px-4 py-2 text-[11px] text-fg-tertiary">
            <span className="flex items-center gap-1.5">
              <Kbd>{MOD}</Kbd>
              <Kbd>K</Kbd> Open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>
                <ArrowUp size={10} />
              </Kbd>
              <Kbd>
                <ArrowDown size={10} />
              </Kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Enter</Kbd> Trade
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>{MOD}</Kbd>
              <Kbd>S</Kbd> Favorite
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd> Close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The market-bar trigger plus the global ⌘K / Ctrl+K shortcut */
export function MarketCommand() {
  const [open, setOpen] = useState(false);
  const { selectedMarket } = useSelectedMarket();

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Switch market"
        className="group flex h-full w-[200px] items-center gap-2 px-3 text-left transition-colors hover:bg-state-hover"
      >
        <span className="text-lg font-medium text-fg-primary">
          {selectedMarket?.name ?? 'Select market'}
        </span>
        <CaretDown
          size={14}
          className="text-fg-tertiary transition-transform group-hover:translate-y-px"
        />
        <span className="ml-auto hidden items-center gap-0.5 xl:flex">
          <Kbd>{MOD}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <MarketPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
