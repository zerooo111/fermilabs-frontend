// The v2 trading terminal: a market bar over a dockview sheet of movable,
// resizable panes with a collapsible bottom drawer. Layout and theme controls
// live in a navbar popover.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewTheme,
} from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { debounce } from 'lodash';

import { NAVBAR_SLOT_ID } from '@/shared/ui/layout/navbar-slot';

import {
  type PresetId,
  addToBottom,
  applyPreset,
  forgetLayout,
  loadLayout,
  saveLayout,
  tidyGroups,
} from '../lib/layouts';
import type { PaneDef, PaneId } from '../lib/panels';
import { THEMES, useTerminalTheme } from '../lib/theme';
import { GroupActions } from './GroupActions';
import { LayoutMenu } from './LayoutMenu';
import { MarketBar } from './MarketBar';
import { paneComponents } from './panes';
import '../themes.css';
import '../perps-v2.css';

// Colours come from the page theme's tokens; only the scheme varies here
const dockTheme = (scheme: 'light' | 'dark'): DockviewTheme => ({
  name: `fermi-${scheme}`,
  className: 'dockview-theme-fermi',
  colorScheme: scheme,
  gap: 0,
  edgeGroupCollapsedSize: 32,
  dndOverlayMounting: 'absolute',
  dndPanelOverlay: 'group',
  dndTabIndicator: 'line',
  tabGroupIndicator: 'none',
  tabAnimation: 'smooth',
});

function Watermark() {
  return (
    <div className="pv2-watermark">
      <span>Empty</span>
      <span>Drag a tab here, or reopen a pane from Layout</span>
    </div>
  );
}

function useOpenPanes(api: DockviewApi | null) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!api) return;
    const sync = () => setOpen(new Set(api.panels.map(p => p.id)));
    sync();
    const subs = [
      api.onDidAddPanel(sync),
      api.onDidRemovePanel(sync),
      api.onDidLayoutFromJSON(sync),
    ];
    return () => subs.forEach(s => s.dispose());
  }, [api]);
  return open;
}

/** The header's page slot, once it is in the DOM */
function useNavbarSlot() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(NAVBAR_SLOT_ID)), []);
  return slot;
}

export function TerminalDock() {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const [preset, setPreset] = useState<PresetId | null>(null);
  const open = useOpenPanes(api);
  const applying = useRef(false);
  const [theme, setTheme] = useTerminalTheme();
  const scheme = THEMES.find(t => t.id === theme)?.scheme ?? 'dark';
  const dockviewTheme = useMemo(() => dockTheme(scheme), [scheme]);
  const navbarSlot = useNavbarSlot();

  const onReady = useCallback((event: DockviewReadyEvent) => {
    if (!loadLayout(event.api)) {
      applyPreset(event.api, 'classic');
      setPreset('classic');
    }
    tidyGroups(event.api);
    setApi(event.api);
  }, []);

  // Remember whatever the user arranges; a preset stays "selected" until
  // they move something
  useEffect(() => {
    if (!api) return;
    const save = debounce(() => saveLayout(api), 400);
    const sub = api.onDidLayoutChange(() => {
      tidyGroups(api);
      if (!applying.current) setPreset(null);
      save();
    });
    return () => {
      sub.dispose();
      save.flush();
    };
  }, [api]);

  const choosePreset = (id: PresetId) => {
    if (!api) return;
    applying.current = true;
    applyPreset(api, id);
    setPreset(id);
    // Layout events from the rebuild land asynchronously
    requestAnimationFrame(() => (applying.current = false));
  };

  const reset = () => {
    forgetLayout();
    choosePreset('classic');
  };

  const togglePane = (pane: PaneDef) => {
    if (!api) return;
    const existing = api.getPanel(pane.id);
    if (existing) {
      existing.api.close();
      return;
    }
    if (pane.home === 'bottom') {
      addToBottom(api, pane.id, false);
      api.getEdgeGroup('bottom')?.expand();
    } else {
      api.addPanel({
        id: pane.id,
        component: pane.id,
        title: pane.title,
        floating: { position: { top: 48, left: 48 }, width: 360, height: 480 },
      });
    }
  };

  return (
    <div className="pv2 flex h-full min-h-0 flex-col">
      {navbarSlot &&
        createPortal(
          <LayoutMenu
            preset={preset}
            onPreset={choosePreset}
            open={open}
            onTogglePane={togglePane}
            theme={theme}
            onTheme={setTheme}
            onReset={reset}
          />,
          navbarSlot
        )}

      <MarketBar />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <DockviewReact
          theme={dockviewTheme}
          components={paneComponents as Record<PaneId, React.FunctionComponent>}
          rightHeaderActionsComponent={GroupActions}
          watermarkComponent={Watermark}
          onReady={onReady}
          // Keep panes mounted when hidden or moved: the chart and the
          // streams underneath must not rebuild on every drag
          defaultRenderer="always"
          floatingGroupBounds="boundedWithinViewport"
          // Move floating windows by the empty part of their tab strip, no
          // separate grab bar
          floatingGroupDragHandle="tabbar"
          singleTabMode="default"
          disableTabsOverflowList
        />
      </div>
    </div>
  );
}
