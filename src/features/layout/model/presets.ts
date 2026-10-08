/**
 * Layout presets. Each preset builds a layout imperatively through the
 * dockview API so it stays valid across dockview upgrades (unlike a
 * hand-written serialized blob).
 */
import type { DockviewApi } from 'dockview-react';
import { WIDGET_BY_ID, type WidgetId } from './widgets';

export type LayoutPresetId = 'default' | 'chart-focus' | 'orderbook-focus';

export interface LayoutPreset {
  id: LayoutPresetId;
  label: string;
  apply: (api: DockviewApi) => void;
}

type Position = NonNullable<Parameters<DockviewApi['addPanel']>[0]['position']>;

function add(
  api: DockviewApi,
  id: WidgetId,
  opts: { position?: Position; initialWidth?: number; initialHeight?: number } = {}
) {
  const w = WIDGET_BY_ID[id];
  return api.addPanel({
    id,
    component: id,
    title: w.title,
    minimumWidth: w.minimumWidth,
    minimumHeight: w.minimumHeight,
    ...opts,
  });
}

/** Proportional layout rescales `initialWidth` as later panels are added; pin sizes once the tree is built. */
function size(api: DockviewApi, id: WidgetId, dims: { width?: number; height?: number }) {
  api.getPanel(id)?.api.setSize(dims);
}

/**
 * Mirrors the original CSS-grid layout:
 *   [ chart | orderbook ] [ ticket  ]
 *   [ portfolio tabs    ] [ account ]
 */
function applyDefault(api: DockviewApi) {
  api.clear();
  add(api, 'chart');
  add(api, 'positions', {
    position: { referencePanel: 'chart', direction: 'below' },
    initialHeight: 280,
  });
  add(api, 'orders', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'my-trades', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'assets', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'orderbook', {
    position: { referencePanel: 'chart', direction: 'right' },
    initialWidth: 340,
  });
  add(api, 'trades', { position: { referencePanel: 'orderbook', direction: 'within' } });
  // Absolute position: a full-height column on the right edge of the whole dock.
  add(api, 'ticket', { position: { direction: 'right' }, initialWidth: 320 });
  add(api, 'account', {
    position: { referencePanel: 'ticket', direction: 'below' },
    initialHeight: 260,
  });
  size(api, 'ticket', { width: 320 });
  size(api, 'orderbook', { width: 340 });
  size(api, 'positions', { height: 280 });
  size(api, 'account', { height: 260 });
  api.getPanel('positions')?.api.setActive();
  api.getPanel('orderbook')?.api.setActive();
  api.getPanel('chart')?.api.setActive();
}

/** Big chart, everything else tucked into tabs on the right. */
function applyChartFocus(api: DockviewApi) {
  api.clear();
  add(api, 'chart');
  add(api, 'positions', {
    position: { referencePanel: 'chart', direction: 'below' },
    initialHeight: 200,
  });
  add(api, 'orders', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'my-trades', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'assets', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'ticket', { position: { direction: 'right' }, initialWidth: 320 });
  add(api, 'orderbook', { position: { referencePanel: 'ticket', direction: 'within' } });
  add(api, 'trades', { position: { referencePanel: 'ticket', direction: 'within' } });
  add(api, 'account', {
    position: { referencePanel: 'ticket', direction: 'below' },
    initialHeight: 240,
  });
  size(api, 'ticket', { width: 340 });
  size(api, 'positions', { height: 200 });
  size(api, 'account', { height: 240 });
  api.getPanel('positions')?.api.setActive();
  api.getPanel('ticket')?.api.setActive();
  api.getPanel('chart')?.api.setActive();
}

/** Orderbook and trades side by side, chart smaller. */
function applyOrderbookFocus(api: DockviewApi) {
  api.clear();
  add(api, 'orderbook');
  add(api, 'trades', { position: { referencePanel: 'orderbook', direction: 'right' } });
  add(api, 'chart', {
    position: { referencePanel: 'orderbook', direction: 'left' },
    initialWidth: 520,
  });
  add(api, 'positions', {
    position: { referencePanel: 'chart', direction: 'below' },
    initialHeight: 240,
  });
  add(api, 'orders', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'my-trades', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'assets', { position: { referencePanel: 'positions', direction: 'within' } });
  add(api, 'ticket', { position: { direction: 'right' }, initialWidth: 320 });
  add(api, 'account', {
    position: { referencePanel: 'ticket', direction: 'below' },
    initialHeight: 260,
  });
  size(api, 'ticket', { width: 320 });
  size(api, 'chart', { width: 520 });
  size(api, 'positions', { height: 240 });
  size(api, 'account', { height: 260 });
  api.getPanel('positions')?.api.setActive();
  api.getPanel('chart')?.api.setActive();
}

export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
  { id: 'default', label: 'Default', apply: applyDefault },
  { id: 'chart-focus', label: 'Chart focus', apply: applyChartFocus },
  { id: 'orderbook-focus', label: 'Orderbook focus', apply: applyOrderbookFocus },
];

export const DEFAULT_PRESET = LAYOUT_PRESETS[0];

/** Open a widget that is not currently in the layout, as a tab in the active group. */
export function openWidget(api: DockviewApi, id: WidgetId) {
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const active = api.activeGroup;
  add(api, id, active ? { position: { referenceGroup: active, direction: 'within' } } : {});
}
