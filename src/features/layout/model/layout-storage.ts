/**
 * Persisted terminal layout. Stored per browser via jotai `atomWithStorage`.
 *
 * The stored shape is versioned so a widget rename or a dockview upgrade can
 * invalidate stale layouts instead of crashing `fromJSON`.
 */
import { atomWithStorage } from 'jotai/utils';
import type { SerializedDockview } from 'dockview-react';
import { isWidgetId } from './widgets';

export const LAYOUT_SCHEMA_VERSION = 1;

export interface StoredLayout {
  version: number;
  layout: SerializedDockview;
}

export const terminalLayoutAtom = atomWithStorage<StoredLayout | null>(
  'perps:layout',
  null,
  undefined,
  { getOnInit: true }
);

/** When true, drag/drop and closing panes are disabled; resizing still works. */
export const layoutLockedAtom = atomWithStorage<boolean>('perps:layout:locked', false, undefined, {
  getOnInit: true,
});

/** Escape hatch back to the fixed CSS-grid layout. */
export const useClassicLayoutAtom = atomWithStorage<boolean>(
  'perps:layout:classic',
  false,
  undefined,
  { getOnInit: true }
);

/** A stored layout is usable only if its version matches and every panel maps to a known widget. */
export function isUsableStoredLayout(stored: StoredLayout | null): stored is StoredLayout {
  if (!stored || stored.version !== LAYOUT_SCHEMA_VERSION) return false;
  const panels = stored.layout?.panels;
  if (!panels || typeof panels !== 'object') return false;
  return Object.values(panels).every(
    p => typeof p.contentComponent === 'string' && isWidgetId(p.contentComponent)
  );
}
