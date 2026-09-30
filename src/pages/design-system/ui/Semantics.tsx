/**
 * Semantic token sections: surfaces, foreground, lines, states, status.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

import { FOREGROUNDS, LINES, STATES, STATUSES, STATUS_ROLES, SURFACES } from '../model/tokens';
import { contrast, toHex, tokenVar, useTokens } from '../lib/color';
import { CopyChip, GradeTag, Section, SubHeading, TableScroll, TD, TH } from './parts';

const STACK = ['surface-canvas', 'surface-base', 'surface-raised', 'surface-overlay'];
const MATRIX_SURFACES = ['surface-sunken', ...STACK];
const STEP_PAIRS = MATRIX_SURFACES.slice(1).map((front, i) => [MATRIX_SURFACES[i], front]);

export function Surfaces() {
  const values = useTokens(SURFACES.map(s => s.name));

  return (
    <Section
      id="surfaces"
      eyebrow="04 Surfaces"
      title="Surfaces"
      lede="Five opaque layers, back to front. Each is one even notch lighter than the one behind it, and the notch grows a little toward the front so popovers separate cleanly from panels. Nest one step at a time. If you need a sixth level, the layout is too deep."
    >
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="border border-line bg-surface-sunken p-4">
          <span className="font-mono text-[11px] text-fg-tertiary">surface-sunken</span>
          <div className="mt-3 border border-line bg-surface-canvas p-4">
            <span className="font-mono text-[11px] text-fg-tertiary">surface-canvas</span>
            <div className="mt-3 border border-line bg-surface-base p-4">
              <span className="font-mono text-[11px] text-fg-tertiary">surface-base</span>
              <div className="mt-3 border border-line bg-surface-raised p-4">
                <span className="font-mono text-[11px] text-fg-tertiary">surface-raised</span>
                <div className="mt-3 border border-line bg-surface-overlay p-4 shadow-lg shadow-black/40">
                  <span className="font-mono text-[11px] text-fg-tertiary">surface-overlay</span>
                  <p className="mt-2 text-sm text-fg-primary">Popover content</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <TableScroll>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Token</th>
                <th className={TH}>Value</th>
                <th className={TH}>Use for</th>
              </tr>
            </thead>
            <tbody>
              {SURFACES.map(s => (
                <tr key={s.name}>
                  <td className={TD}>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-5 shrink-0 border border-line"
                        style={{ background: tokenVar(s.name) }}
                      />
                      <CopyChip value={`bg-${s.name}`} />
                    </div>
                  </td>
                  <td className={cn(TD, 'font-mono text-xs text-fg-tertiary whitespace-nowrap')}>
                    {values[s.name] ? toHex(values[s.name]) : '…'}
                  </td>
                  <td className={TD}>{s.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <SubHeading>Step between layers</SubHeading>
      <ol className="grid gap-px border border-line bg-line sm:grid-cols-4">
        {STEP_PAIRS.map(([back, front]) => (
          <li key={front} className="flex items-center gap-3 bg-surface-base p-3">
            <span className="flex shrink-0">
              <span className="size-6 border border-line" style={{ background: tokenVar(back) }} />
              <span
                className="-ml-2 mt-2 size-6 border border-line"
                style={{ background: tokenVar(front) }}
              />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-mono text-[11px] text-fg-secondary">
                {back.replace('surface-', '')} to {front.replace('surface-', '')}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-fg-tertiary">
                {values[back] && values[front]
                  ? `${contrast(values[front], values[back]).toFixed(3)} : 1`
                  : '…'}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function Foreground() {
  const names = [...FOREGROUNDS.map(f => f.name), ...MATRIX_SURFACES];
  const values = useTokens(names);
  const readable = FOREGROUNDS.filter(f => f.name !== 'fg-inverse');

  return (
    <Section
      id="foreground"
      eyebrow="05 Foreground"
      title="Text and icons"
      lede="Four steps of emphasis on dark, one for inverse fills. Each cell below is live contrast against the surface in its column, measured from the stylesheet."
    >
      <TableScroll>
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className={TH}>Token</th>
              {MATRIX_SURFACES.map(s => (
                <th key={s} className={TH}>
                  {s.replace('surface-', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {readable.map(f => (
              <tr key={f.name}>
                <td className={cn(TD, 'w-56')}>
                  <CopyChip value={`text-${f.name}`} />
                  <p className="mt-1 text-xs text-fg-tertiary">{f.use}</p>
                </td>
                {MATRIX_SURFACES.map(s => (
                  <td
                    key={s}
                    className="border-b border-l border-line-subtle px-3 py-2.5"
                    style={{ background: tokenVar(s) }}
                  >
                    <span
                      className="block text-base font-medium"
                      style={{ color: tokenVar(f.name) }}
                    >
                      Mark price
                    </span>
                    <GradeTag
                      ratio={
                        values[f.name] && values[s]
                          ? contrast(values[f.name], values[s])
                          : undefined
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <SubHeading>Hierarchy in use</SubHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-line bg-surface-base p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-tertiary">
            Unrealized PnL
          </p>
          <p className="mt-1 font-mono text-2xl text-fg-primary">+$1,204.58</p>
          <p className="mt-3 text-sm leading-6 text-fg-secondary">
            Marked against the oracle price. Closing the position turns this into realized PnL.
          </p>
          <p className="mt-3 font-mono text-xs text-fg-tertiary">Updated 12:04:31 UTC</p>
        </div>
        <div className="flex flex-col justify-between gap-4 border border-line bg-surface-base p-5">
          <div className="flex flex-wrap gap-2">
            <span className="bg-surface-inverse px-3 py-1.5 text-sm font-medium text-fg-inverse">
              fg-inverse on surface-inverse
            </span>
            <span className="border border-line px-3 py-1.5 text-sm text-fg-disabled">
              fg-disabled
            </span>
          </div>
          <p className="text-sm leading-6 text-fg-secondary">
            Use fg-disabled only on controls that cannot be used. It fails contrast so readers skip
            it, which is the point.
          </p>
        </div>
      </div>
    </Section>
  );
}

export function Lines() {
  const values = useTokens(LINES.map(l => l.name));

  return (
    <Section
      id="lines"
      eyebrow="06 Lines"
      title="Borders and dividers"
      lede="The terminal is flat. Lines do the work that shadows and radii do elsewhere, so there are only five and each has one job. Tabs use a 5% tint when active, not the stronger selected tint, so a tab strip never outweighs the data below it."
    >
      <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {LINES.map(l => (
          <div key={l.name} className="flex flex-col gap-4 bg-surface-base p-4">
            <div
              className={cn(
                'flex h-20 items-center justify-center bg-surface-raised text-xs text-fg-tertiary',
                l.name === 'line-focus' ? 'ring-2' : 'border'
              )}
              style={
                l.name === 'line-focus'
                  ? { ['--tw-ring-color' as string]: tokenVar(l.name) }
                  : { borderColor: tokenVar(l.name) }
              }
            >
              {l.name === 'line-focus' ? 'ring-2 ring-line-focus' : `border-${l.name}`}
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <CopyChip
                  value={l.name === 'line-focus' ? 'ring-line-focus' : `border-${l.name}`}
                />
                <span className="font-mono text-[11px] text-fg-tertiary">
                  {values[l.name] ? toHex(values[l.name]) : ''}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-fg-tertiary">{l.use}</p>
            </div>
          </div>
        ))}
      </div>

      <SubHeading>Panel anatomy</SubHeading>
      <div className="max-w-xl border border-line bg-surface-base">
        <div className="flex h-11 items-center border-b border-line bg-surface-raised px-4 text-sm font-medium text-fg-primary">
          Open orders
          <span className="ml-auto font-mono text-[11px] text-fg-tertiary">border-line</span>
        </div>
        <div className="divide-y divide-line-subtle">
          {[
            'SOL-PERP  Limit  Buy  12.5',
            'BTC-PERP  Limit  Sell  0.40',
            'ETH-PERP  Stop  Sell  3.00',
          ].map(row => (
            <div
              key={row}
              className="flex items-center justify-between px-4 py-2.5 font-mono text-xs text-fg-secondary"
            >
              {row}
              <span className="text-fg-tertiary">divide-line-subtle</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function States() {
  const [selected, setSelected] = useState(1);
  const rows = ['SOL-PERP', 'BTC-PERP', 'ETH-PERP', 'JUP-PERP'];

  const menu = (surface: string) => (
    <div className={cn('border border-line', surface)}>
      {rows.map((row, i) => (
        <button
          key={row}
          type="button"
          onClick={() => setSelected(i)}
          aria-pressed={selected === i}
          className={cn(
            'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-fg-secondary outline-none',
            'hover:bg-state-hover hover:text-fg-primary active:bg-state-pressed',
            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus',
            selected === i && 'bg-state-selected text-fg-primary'
          )}
        >
          {row}
          {selected === i && (
            <span className="font-mono text-[11px] text-fg-tertiary">selected</span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <Section
      id="states"
      eyebrow="07 States"
      title="Interaction states"
      lede="The only translucent tokens. They are rock at 5, 9 and 12 percent, so one class works on the canvas, inside a panel or inside a popover. Hover, press and tab through the lists."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="mb-2 font-mono text-[11px] text-fg-tertiary">on surface-canvas</p>
          {menu('bg-surface-canvas')}
        </div>
        <div>
          <p className="mb-2 font-mono text-[11px] text-fg-tertiary">on surface-base</p>
          {menu('bg-surface-base')}
        </div>
        <div>
          <p className="mb-2 font-mono text-[11px] text-fg-tertiary">on surface-overlay</p>
          {menu('bg-surface-overlay')}
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {STATES.map(s => (
          <li key={s.name} className="border border-line-subtle bg-surface-base p-3">
            <CopyChip value={`bg-${s.name}`} />
            <p className="mt-1 text-xs text-fg-tertiary">{s.use}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const STATUS_ICON = {
  positive: CheckCircle2,
  negative: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function Status() {
  const names = [
    ...STATUSES.flatMap(s => STATUS_ROLES.map(r => `${s.key}-${r}`)),
    'surface-canvas',
    'surface-overlay',
    'fg-inverse',
  ];
  const values = useTokens(names);

  return (
    <Section
      id="status"
      eyebrow="08 Status"
      title="Status colors"
      lede="Four hues, four roles each. fg for text and icons, solid for filled buttons and bars, muted for tinted backgrounds, line for the border around a muted fill. Solid fills take fg-inverse text and hover to *-solid-hover. Every muted tint and every line sits at the same lightness, so no status shouts louder than another."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {STATUSES.map(s => {
          const Icon = STATUS_ICON[s.key];
          const v = (role: string) => values[`${s.key}-${role}`];
          return (
            <div key={s.key} className="border border-line bg-surface-base">
              <div className="flex items-center gap-2 border-b border-line bg-surface-raised px-4 py-2.5">
                <span className="text-sm font-medium text-fg-primary">{s.label}</span>
                <span className="text-xs text-fg-tertiary">{s.use}</span>
              </div>

              <div className="grid grid-cols-4">
                {STATUS_ROLES.map(role => (
                  <div key={role} className="border-r border-line-subtle last:border-r-0">
                    <div className="h-12" style={{ background: tokenVar(`${s.key}-${role}`) }} />
                    <div className="flex flex-col gap-0.5 p-2">
                      <CopyChip value={`${s.key}-${role}`} className="text-[11px]" />
                      <span className="font-mono text-[10px] text-fg-tertiary">
                        {v(role) ? toHex(v(role)) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle p-4">
                <span
                  className="inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: tokenVar(`${s.key}-muted`),
                    borderColor: tokenVar(`${s.key}-line`),
                    color: tokenVar(`${s.key}-fg`),
                  }}
                >
                  <Icon className="size-3" />
                  {s.label}
                </span>
                <button
                  type="button"
                  className="h-8 px-3 text-xs font-medium text-fg-inverse hover:brightness-110"
                  style={{ background: tokenVar(`${s.key}-solid`) }}
                >
                  Solid action
                </button>
                <span className="font-mono text-sm" style={{ color: tokenVar(`${s.key}-fg`) }}>
                  {s.key === 'negative' ? '-2.41%' : s.key === 'positive' ? '+4.18%' : '12.5x'}
                </span>
              </div>

              <dl className="grid grid-cols-3 gap-2 border-t border-line-subtle px-4 py-3 text-[11px]">
                <div>
                  <dt className="text-fg-tertiary">fg on canvas</dt>
                  <dd>
                    <GradeTag
                      ratio={
                        v('fg') && values['surface-canvas']
                          ? contrast(v('fg'), values['surface-canvas'])
                          : undefined
                      }
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-tertiary">fg on muted</dt>
                  <dd>
                    <GradeTag
                      ratio={v('fg') && v('muted') ? contrast(v('fg'), v('muted')) : undefined}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-tertiary">inverse on solid</dt>
                  <dd>
                    <GradeTag
                      ratio={
                        v('solid') && values['fg-inverse']
                          ? contrast(values['fg-inverse'], v('solid'))
                          : undefined
                      }
                    />
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-5 text-fg-tertiary">
        Never put white text on a solid fill. White on negative-solid is 3.8:1 and white on
        positive-solid is 2.5:1, both below AA. fg-inverse passes on all four.
      </p>
    </Section>
  );
}

const BRAND_TOKENS = [
  { name: 'line-on-brand', use: 'Dividers and card edges on brand green.' },
  { name: 'line-on-brand-strong', use: 'Header rule, hovered cards on brand green.' },
  { name: 'accent-solid', use: 'The amber cream CTA fill. Hover with accent-solid-hover.' },
  { name: 'fg-on-accent', use: 'Text on accent-solid.' },
  { name: 'accent-fg', use: 'Nav and link hover text on brand green.' },
];

export function BrandContext() {
  const names = [
    'surface-brand',
    'fg-primary',
    'fg-secondary',
    'fg-tertiary',
    'accent-solid',
    'fg-on-accent',
    'accent-fg',
  ];
  const values = useTokens(names);
  const on = (fg: string, bg: string) =>
    values[fg] && values[bg] ? contrast(values[fg], values[bg]) : undefined;

  return (
    <Section
      id="brand"
      eyebrow="09 Brand"
      title="Brand context"
      lede="The landing page, splash and waitlist sit on brand green instead of the canvas. The neutral line tokens are as dark as brand green, so they vanish there, and fg-tertiary drops below 4.5:1. Brand surfaces get their own lines and an amber accent that never appears inside the terminal, where yellow means warning."
    >
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="border border-line-on-brand bg-surface-brand">
          <div className="flex items-center justify-between border-b border-line-on-brand-strong px-5 py-3">
            <span className="font-display text-2xl text-fg-primary">Fermi</span>
            <span className="flex gap-4 text-sm text-fg-secondary">
              <span className="cursor-pointer hover:text-accent-fg">Docs</span>
              <span className="cursor-pointer hover:text-accent-fg">Blog</span>
            </span>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <p className="font-display text-4xl text-fg-primary">Trade without the wait.</p>
            <p className="max-w-md text-sm leading-6 text-fg-secondary">
              Body copy on brand green uses fg-secondary. That is the dimmest step allowed here.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="bg-accent-solid px-5 py-2.5 text-sm font-medium text-fg-on-accent outline-none hover:bg-accent-solid-hover focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                Join the waitlist
              </button>
              <span className="text-xs text-fg-tertiary">fg-tertiary fails here</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line-on-brand border border-line-on-brand">
              {['Latency', 'Markets', 'Fees'].map(k => (
                <div key={k} className="px-3 py-2 text-xs text-fg-secondary">
                  {k}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-px border border-line bg-line-subtle text-[11px]">
            {(
              [
                ['fg-primary on brand', on('fg-primary', 'surface-brand')],
                ['fg-secondary on brand', on('fg-secondary', 'surface-brand')],
                ['fg-tertiary on brand', on('fg-tertiary', 'surface-brand')],
                ['fg-on-accent on accent', on('fg-on-accent', 'accent-solid')],
                ['accent-fg on brand', on('accent-fg', 'surface-brand')],
              ] as const
            ).map(([label, ratio]) => (
              <div key={label} className="bg-surface-base p-3">
                <dt className="text-fg-tertiary">{label}</dt>
                <dd>
                  <GradeTag ratio={ratio} />
                </dd>
              </div>
            ))}
          </dl>
          <ul className="flex flex-col border border-line bg-surface-base">
            {BRAND_TOKENS.map(t => (
              <li
                key={t.name}
                className="flex flex-col gap-0.5 border-b border-line-subtle px-3 py-2 last:border-b-0"
              >
                <CopyChip value={t.name} />
                <span className="text-xs text-fg-tertiary">{t.use}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
