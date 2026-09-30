/**
 * Token metadata for the /design-system page. Values live in src/index.css;
 * this file only names them and says what each one is for. The page reads
 * the real values from CSS at runtime, so the two cannot drift.
 */

export interface TokenInfo {
  /** CSS variable without the leading `--color-`. */
  name: string;
  /** What the token is for, in one line. */
  use: string;
}

export interface RampStep {
  step: string;
  /** OKLCH lightness, shown next to the swatch. */
  l: string;
}

export const FOREST_RAMP: RampStep[] = [
  { step: '50', l: 'L 0.973' },
  { step: '100', l: 'L 0.930' },
  { step: '200', l: 'L 0.870' },
  { step: '300', l: 'L 0.790' },
  { step: '400', l: 'L 0.690' },
  { step: '500', l: 'L 0.585' },
  { step: '600', l: 'L 0.515' },
  { step: '650', l: 'L 0.455' },
  { step: '700', l: 'L 0.385' },
  { step: '750', l: 'L 0.338' },
  { step: '800', l: 'L 0.299' },
  { step: '850', l: 'L 0.262' },
  { step: '900', l: 'L 0.226' },
  { step: '950', l: 'L 0.187' },
  { step: '1000', l: 'L 0.154' },
];

export const BRAND_RAMP = ['300', '400', '500'];

/** Ordered back to front. */
export const SURFACES: TokenInfo[] = [
  { name: 'surface-sunken', use: 'Inputs, chart wells, code blocks. Sits below the page.' },
  { name: 'surface-canvas', use: 'The page. Header, trading layout background, dialogs.' },
  {
    name: 'surface-base',
    use: 'A card that must lift off the canvas. Rare: panels are unfilled by default.',
  },
  { name: 'surface-raised', use: 'Panel headers, table headers, a card inside a panel.' },
  { name: 'surface-overlay', use: 'Popovers, dropdowns, tooltips, select menus.' },
  {
    name: 'surface-inverse',
    use: 'Primary button fill, chosen preset chips. Pair with fg-inverse. Hover with surface-inverse-hover.',
  },
  {
    name: 'surface-brand',
    use: 'Landing page, splash, marketing blocks. Not inside the terminal.',
  },
];

export const FOREGROUNDS: TokenInfo[] = [
  { name: 'fg-primary', use: 'Headings, values, anything the eye should land on.' },
  { name: 'fg-secondary', use: 'Body copy, table cells, descriptions.' },
  { name: 'fg-tertiary', use: 'Labels, eyebrows, timestamps, placeholder text.' },
  { name: 'fg-disabled', use: 'Disabled controls only. Fails contrast on purpose.' },
  { name: 'fg-inverse', use: 'Text on surface-inverse and on solid status fills.' },
];

export const LINES: TokenInfo[] = [
  { name: 'line-faint', use: 'Hairlines between dense data rows: trades, orderbook.' },
  { name: 'line-subtle', use: 'Row dividers and separators inside one panel.' },
  { name: 'line', use: 'Panel edges, input borders, the default border.' },
  { name: 'line-strong', use: 'Hovered inputs, selected cards, emphasis edges.' },
  { name: 'line-focus', use: 'Keyboard focus ring. Use as ring color, 2px.' },
];

export const STATES: TokenInfo[] = [
  { name: 'state-hover', use: 'Pointer over a row, menu item or ghost button.' },
  { name: 'state-pressed', use: 'Mouse down, or a toggle that is on.' },
  { name: 'state-selected', use: 'The current row, tab or menu item.' },
  { name: 'state-strong', use: 'Scrollbar thumb on hover, slider halo. Rare.' },
];

export const STATUSES = [
  { key: 'positive', label: 'Positive', use: 'Buy, long, profit, success, connected.' },
  { key: 'negative', label: 'Negative', use: 'Sell, short, loss, errors, liquidation risk.' },
  { key: 'warning', label: 'Warning', use: 'Devnet, beta, pending, high leverage.' },
  { key: 'info', label: 'Info', use: 'Neutral notices, testnet, links in copy.' },
] as const;

export const STATUS_ROLES = ['fg', 'solid', 'muted', 'line'] as const;

export interface MigrationRow {
  from: string[];
  to: string;
  note?: string;
}

/** Old ad hoc classes and the semantic token that replaces each group. */
export const MIGRATION: MigrationRow[] = [
  { from: ['bg-background'], to: 'bg-surface-canvas' },
  { from: ['bg-card', 'bg-white/5'], to: 'bg-surface-raised', note: 'For static fills.' },
  { from: ['hover:bg-card', 'hover:bg-white/5'], to: 'hover:bg-state-hover' },
  {
    from: ['bg-white/10', 'bg-white/15'],
    to: 'bg-state-selected',
    note: 'Or surface-overlay if it is a container.',
  },
  { from: ['bg-dark-forest'], to: 'bg-surface-brand' },
  { from: ['border-outline', 'border-rock/20', 'border-white/20'], to: 'border-line' },
  { from: ['divide-rock/20', 'divide-white/5', 'divide-outline'], to: 'divide-line-subtle' },
  { from: ['border-rock/30', 'border-rock/40', 'border-white/40'], to: 'border-line-strong' },
  { from: ['text-rock', 'text-white', 'text-zinc-100', 'text-white/90'], to: 'text-fg-primary' },
  {
    from: ['text-white/80', 'text-white/70', 'text-rock/70', 'text-rock/80', 'text-zinc-300'],
    to: 'text-fg-secondary',
  },
  {
    from: ['text-white/60', 'text-white/55', 'text-rock/60', 'text-white/50', 'text-rock/50'],
    to: 'text-fg-tertiary',
  },
  {
    from: ['text-white/40', 'text-rock/40', 'text-white/25', 'text-white/30'],
    to: 'text-fg-tertiary or text-fg-disabled',
    note: 'Below 4.5:1 today. Pick by intent.',
  },
  { from: ['text-success', 'text-green-400', 'text-emerald-400'], to: 'text-positive-fg' },
  { from: ['text-danger', 'text-red-400', 'text-red-500'], to: 'text-negative-fg' },
  { from: ['text-amber-300', 'text-amber-400'], to: 'text-warning-fg' },
  { from: ['text-blue-400'], to: 'text-info-fg' },
  { from: ['ring-rock/50'], to: 'ring-line-focus' },
];

/** How each shared component uses the tokens. Source of truth is src/shared/ui. */
export const RECIPES = [
  {
    component: 'Button default',
    tokens: 'surface-inverse, fg-inverse, hover surface-inverse-hover',
  },
  {
    component: 'Button success / destructive',
    tokens: 'positive-solid / negative-solid, fg-inverse, hover *-solid-hover',
  },
  {
    component: 'Button outline / secondary / ghost',
    tokens: 'line or surface-raised, hover state-hover, active state-pressed',
  },
  { component: 'Focus, every control', tokens: 'ring-2 line-focus, offset surface-canvas' },
  {
    component: 'Input, Select trigger',
    tokens: 'surface-sunken, line, hover line-strong, placeholder fg-tertiary',
  },
  {
    component: 'Popover, Dropdown, Select menu, Tooltip',
    tokens: 'surface-overlay, line, fg-primary. No blur.',
  },
  {
    component: 'Dialog',
    tokens: 'surface-canvas, line, over a scrim. Cards inside use surface-raised.',
  },
  { component: 'Dialog backdrop', tokens: 'scrim' },
  {
    component: 'Tabs',
    tokens:
      'inactive fg-tertiary, hover state-hover, active state-hover tint + fg-primary underline',
  },
  {
    component: 'Table',
    tokens: 'header surface-raised + fg-tertiary, rows line-subtle, hover state-hover',
  },
  { component: 'Panel', tokens: 'no fill, line frame, header strip surface-raised' },
  { component: 'Orderbook depth bar', tokens: 'positive-solid/25, negative-solid/25' },
  { component: 'Badge status', tokens: '{status}-muted, {status}-line, {status}-fg' },
  {
    component: 'Toast',
    tokens: 'surface-overlay, line; success and error use {status}-muted/-line/-fg',
  },
  {
    component: 'Chart (JS)',
    tokens: 'readChartColors() in shared/lib/color-tokens.ts',
  },
];
