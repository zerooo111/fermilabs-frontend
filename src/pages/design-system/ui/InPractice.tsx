/**
 * A composed trading panel built only from tokens, then the migration map
 * from today's ad hoc classes.
 */
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { MIGRATION, RECIPES } from '../model/tokens';
import { CopyChip, Section, SubHeading, TableScroll, TD, TH } from './parts';

const POSITIONS = [
  { market: 'SOL-PERP', side: 'Long', size: '120.00', entry: '142.18', pnl: '+312.40', up: true },
  { market: 'BTC-PERP', side: 'Short', size: '0.40', entry: '64,210.0', pnl: '-88.12', up: false },
  { market: 'ETH-PERP', side: 'Long', size: '3.00', entry: '3,104.5', pnl: '+41.07', up: true },
];

function OrderForm() {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');

  return (
    <div className="flex flex-col border border-line bg-surface-base">
      <div className="grid grid-cols-2 border-b border-line">
        {(['buy', 'sell'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            aria-pressed={side === s}
            className={cn(
              'h-10 text-sm font-medium capitalize outline-none hover:bg-state-hover',
              'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus',
              side === s
                ? s === 'buy'
                  ? 'bg-positive-muted text-positive-fg'
                  : 'bg-negative-muted text-negative-fg'
                : 'text-fg-tertiary'
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 p-4">
        {[
          ['Price', '142.20', 'USDC'],
          ['Size', '10.00', 'SOL'],
        ].map(([label, value, unit]) => (
          <label key={label} className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-tertiary">
              {label}
            </span>
            <span className="flex h-9 items-center border border-line bg-surface-sunken px-3 hover:border-line-strong focus-within:ring-2 focus-within:ring-line-focus">
              <input
                defaultValue={value}
                className="w-full bg-transparent font-mono text-sm text-fg-primary outline-none placeholder:text-fg-tertiary"
              />
              <span className="font-mono text-xs text-fg-tertiary">{unit}</span>
            </span>
          </label>
        ))}
        <dl className="flex flex-col gap-1.5 border-t border-line-subtle pt-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-fg-tertiary">Est. fee</dt>
            <dd className="font-mono text-fg-secondary">0.71 USDC</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-tertiary">Leverage</dt>
            <dd className="font-mono text-warning-fg">12.5x</dd>
          </div>
        </dl>
        <button
          type="button"
          className={cn(
            'h-10 text-sm font-medium text-fg-inverse outline-none hover:brightness-110',
            'focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
            side === 'buy' ? 'bg-positive-solid' : 'bg-negative-solid'
          )}
        >
          {side === 'buy' ? 'Buy / Long' : 'Sell / Short'}
        </button>
      </div>
    </div>
  );
}

function PositionsTable() {
  return (
    <div className="flex min-w-0 flex-col border border-line bg-surface-base">
      <div className="flex h-10 items-center gap-4 border-b border-line bg-surface-raised px-4 text-sm">
        <span className="text-fg-primary">Positions</span>
        <span className="text-fg-tertiary">Orders</span>
        <span className="text-fg-tertiary">History</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr>
              {['Market', 'Side', 'Size', 'Entry', 'PnL'].map(h => (
                <th
                  key={h}
                  className="h-8 border-b border-line-subtle px-4 text-left font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-fg-tertiary"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POSITIONS.map(p => (
              <tr key={p.market} className="hover:bg-state-hover">
                <td className="border-b border-line-subtle px-4 py-2.5 text-sm text-fg-primary">
                  {p.market}
                </td>
                <td
                  className={cn(
                    'border-b border-line-subtle px-4 py-2.5 text-sm',
                    p.side === 'Long' ? 'text-positive-fg' : 'text-negative-fg'
                  )}
                >
                  {p.side}
                </td>
                <td className="border-b border-line-subtle px-4 py-2.5 font-mono text-sm text-fg-secondary">
                  {p.size}
                </td>
                <td className="border-b border-line-subtle px-4 py-2.5 font-mono text-sm text-fg-secondary">
                  {p.entry}
                </td>
                <td
                  className={cn(
                    'border-b border-line-subtle px-4 py-2.5 font-mono text-sm',
                    p.up ? 'text-positive-fg' : 'text-negative-fg'
                  )}
                >
                  {p.pnl}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-line-subtle bg-warning-muted px-4 py-2 text-xs text-warning-fg">
        Devnet. Balances are not real.
      </div>
    </div>
  );
}

export function Example() {
  return (
    <Section
      id="example"
      eyebrow="10 Example"
      title="Put together"
      lede="A slice of the trading screen using nothing but tokens. No alpha outside the hover states, no raw hex, no zinc."
    >
      <div className="grid gap-3 bg-surface-canvas md:grid-cols-[280px_1fr]">
        <OrderForm />
        <PositionsTable />
      </div>
    </Section>
  );
}

export function Migration() {
  return (
    <Section
      id="migration"
      eyebrow="11 Migration"
      title="Replacing what we have"
      lede="How the old ad hoc classes map to tokens. Match by intent, not by the closest number: a white/60 label and a white/60 paragraph end up on different tokens."
    >
      <TableScroll>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className={TH}>Today</th>
              <th className={TH}>Use instead</th>
              <th className={TH}>Note</th>
            </tr>
          </thead>
          <tbody>
            {MIGRATION.map(row => (
              <tr key={row.to + row.from[0]}>
                <td className={TD}>
                  <div className="flex flex-wrap gap-1.5">
                    {row.from.map(f => (
                      <code
                        key={f}
                        className="border border-line-subtle bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-fg-tertiary line-through decoration-negative-fg/60"
                      >
                        {f}
                      </code>
                    ))}
                  </div>
                </td>
                <td className={TD}>
                  <CopyChip value={row.to} className="text-fg-primary" />
                </td>
                <td className={cn(TD, 'text-xs text-fg-tertiary')}>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <SubHeading>Component recipes</SubHeading>
      <p className="mb-4 max-w-2xl text-sm leading-6 text-fg-secondary">
        The shared components in src/shared/ui already follow these. Reach for them before
        hand-rolling a button or a pill. The shadcn names they used to carry, like muted-foreground
        and accent, were never defined in our theme, so they are gone.
      </p>
      <TableScroll>
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <th className={TH}>Component</th>
              <th className={TH}>Tokens</th>
            </tr>
          </thead>
          <tbody>
            {RECIPES.map(r => (
              <tr key={r.component}>
                <td className={cn(TD, 'text-fg-primary')}>{r.component}</td>
                <td className={cn(TD, 'font-mono text-xs')}>{r.tokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Section>
  );
}
