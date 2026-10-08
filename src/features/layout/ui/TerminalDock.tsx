/**
 * TerminalDock
 * Dockview-powered customisable trading terminal: every widget is a pane the
 * user can resize, re-tab, drag around, close and re-open. Layout changes are
 * debounced into localStorage and restored on the next visit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewTheme,
} from 'dockview-react';
import { DOCK_COMPONENTS } from '../model/widgets';
import { DEFAULT_PRESET } from '../model/presets';
import {
  LAYOUT_SCHEMA_VERSION,
  isUsableStoredLayout,
  layoutLockedAtom,
  terminalLayoutAtom,
} from '../model/layout-storage';
import { LayoutToolbar } from './LayoutToolbar';

const FERMI_THEME: DockviewTheme = {
  name: 'fermi',
  className: 'dockview-theme-fermi',
  colorScheme: 'dark',
};

const SAVE_DEBOUNCE_MS = 300;

export function TerminalDock() {
  const stored = useAtomValue(terminalLayoutAtom);
  const setStored = useSetAtom(terminalLayoutAtom);
  const locked = useAtomValue(layoutLockedAtom);
  const [api, setApi] = useState<DockviewApi | null>(null);

  // Only the layout present at mount matters; later writes come from us.
  const initialRef = useRef(stored);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    const dock = event.api;
    let restored = false;
    const initial = initialRef.current;
    if (isUsableStoredLayout(initial)) {
      try {
        dock.fromJSON(initial.layout);
        restored = true;
      } catch (err) {
        console.warn('[layout] stored layout is invalid, falling back to default', err);
      }
    }
    if (!restored) DEFAULT_PRESET.apply(dock);
    setApi(dock);
  }, []);

  // Persist layout changes (debounced).
  useEffect(() => {
    if (!api) return;
    let timer: number | undefined;
    const sub = api.onDidLayoutChange(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setStored({ version: LAYOUT_SCHEMA_VERSION, layout: api.toJSON() });
      }, SAVE_DEBOUNCE_MS);
    });
    return () => {
      sub.dispose();
      window.clearTimeout(timer);
    };
  }, [api, setStored]);

  useEffect(() => {
    api?.updateOptions({ disableDnd: locked, disableFloatingGroups: locked });
  }, [api, locked]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <LayoutToolbar api={api} />
      <div className="terminal-dock relative flex-1 min-h-0" data-locked={locked || undefined}>
        <DockviewReact
          theme={FERMI_THEME}
          components={DOCK_COMPONENTS}
          onReady={onReady}
          singleTabMode="fullwidth"
          floatingGroupBounds="boundedWithinViewport"
          dndEdges={false}
        />
      </div>
    </div>
  );
}
