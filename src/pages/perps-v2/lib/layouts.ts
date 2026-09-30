// Layout presets for the v2 terminal, and persistence of the user's own
// arrangement. The grid holds chart, book and order entry; the account's
// tables live in a bottom edge group that collapses to its tab strip.

import type { DockviewApi, SerializedDockview } from 'dockview-react';

import { type PaneId, paneTitle } from './panels';

export type PresetId = 'classic' | 'scalp' | 'focus';

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'scalp', label: 'Scalp' },
  { id: 'focus', label: 'Focus' },
];

const STORAGE_KEY = 'fermi.perps-v2.layout.v2';
const SIDE_WIDTH = 340;
export const BOTTOM_SIZE = 220;

export function ensureBottom(api: DockviewApi) {
  const existing = api.getEdgeGroup('bottom');
  if (existing) return existing;
  const bottom = api.addEdgeGroup('bottom', {
    id: 'dock-bottom',
    initialSize: BOTTOM_SIZE,
    minimumSize: 140,
  });
  // Edge groups default their tabs to the outer edge; keep them on top
  bottom.setHeaderPosition('top');
  return bottom;
}

// Panes that name themselves (the chart has its toolbar, the ticket its
// buy/sell switch) don't need a tab when they have a group to themselves
const HEADERLESS = new Set<string>(['chart', 'trade']);

/**
 * Keep the chrome minimal after any change: hide the tab strip on a grid
 * group holding one self-describing pane, show it again once panes share the
 * group, and keep the drawer's tabs on its top edge (dockview puts an edge
 * group's tabs on the outer edge, and a restored layout may bring that back).
 */
export function tidyGroups(api: DockviewApi) {
  for (const group of api.groups) {
    const panels = group.panels;
    const soloHeaderless =
      group.api.location.type === 'grid' && panels.length === 1 && HEADERLESS.has(panels[0].id);
    if (group.model.header.hidden !== soloHeaderless) group.model.header.hidden = soloHeaderless;
  }
  const bottom = api.getEdgeGroup('bottom');
  if (bottom && bottom.getHeaderPosition() !== 'top') bottom.setHeaderPosition('top');
}

export function addToBottom(api: DockviewApi, id: PaneId, inactive = true) {
  return api.addPanel({
    id,
    component: id,
    title: paneTitle(id),
    position: { referenceGroup: ensureBottom(api).id },
    inactive,
  });
}

function fillBottom(api: DockviewApi, ids: PaneId[]) {
  ids.forEach((id, i) => addToBottom(api, id, i > 0));
  const bottom = ensureBottom(api);
  if (bottom.isCollapsed()) bottom.expand();
}

const add = (api: DockviewApi, id: PaneId, rest: object = {}) =>
  api.addPanel({ id, component: id, title: paneTitle(id), ...rest });

type Size = { width?: number; height?: number };

// initialWidth/Height only hint; pin the columns once the grid exists. On
// first mount the grid has not been measured yet, so apply again next frame.
function size(api: DockviewApi, id: PaneId, s: Size | (() => Size)) {
  const apply = () => api.getPanel(id)?.group.api.setSize(typeof s === 'function' ? s() : s);
  apply();
  requestAnimationFrame(apply);
}

export function applyPreset(api: DockviewApi, preset: PresetId) {
  api.clear();

  switch (preset) {
    // Today's /perps, made movable: chart | book | order entry
    case 'classic': {
      add(api, 'chart');
      add(api, 'book', {
        position: { referencePanel: 'chart', direction: 'right' },
        initialWidth: SIDE_WIDTH,
      });
      add(api, 'trade', {
        position: { referencePanel: 'book', direction: 'right' },
        initialWidth: SIDE_WIDTH,
      });
      // A resize takes from the right-hand neighbour, so size left to right
      // and let order entry keep what remains
      size(api, 'chart', () => ({ width: api.width - SIDE_WIDTH * 2 }));
      size(api, 'book', { width: SIDE_WIDTH });
      fillBottom(api, ['positions', 'orders', 'fills', 'account', 'assets', 'tape']);
      break;
    }

    // Tape reading: book and market trades as tabs on the left, chart in the middle
    case 'scalp': {
      add(api, 'chart');
      add(api, 'book', {
        position: { referencePanel: 'chart', direction: 'left' },
        initialWidth: 320,
      });
      add(api, 'tape', { position: { referencePanel: 'book' }, inactive: true });
      add(api, 'trade', {
        position: { referencePanel: 'chart', direction: 'right' },
        initialWidth: SIDE_WIDTH,
      });
      size(api, 'book', { width: 320 });
      size(api, 'trade', { width: SIDE_WIDTH });
      fillBottom(api, ['positions', 'orders', 'fills', 'account', 'assets']);
      break;
    }

    // Chart takes the sheet; order entry floats over it
    case 'focus': {
      add(api, 'chart');
      add(api, 'book', {
        position: { referencePanel: 'chart', direction: 'right' },
        initialWidth: 320,
      });
      add(api, 'tape', { position: { referencePanel: 'book' }, inactive: true });
      size(api, 'book', { width: 320 });
      add(api, 'trade', {
        floating: { position: { top: 56, right: 340 }, width: 320, height: 540 },
      });
      fillBottom(api, ['positions', 'orders', 'fills', 'account', 'assets']);
      ensureBottom(api).collapse();
      break;
    }
  }

  api.getPanel('chart')?.api.setActive();
}

export function loadLayout(api: DockviewApi): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    api.fromJSON(JSON.parse(raw) as SerializedDockview);
    return api.panels.length > 0;
  } catch {
    return false;
  }
}

export function saveLayout(api: DockviewApi) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(api.toJSON()));
  } catch {
    // Private mode or quota: the layout just won't survive a reload
  }
}

export function forgetLayout() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
