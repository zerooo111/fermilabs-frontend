/**
 * Slim bar above the dock: open closed widgets, switch presets, lock, reset,
 * or fall back to the classic fixed grid.
 */
import { useEffect, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { DockviewApi } from 'dockview-react';
import { LayoutGrid, Lock, LockOpen, Plus, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { WIDGETS } from '../model/widgets';
import { DEFAULT_PRESET, LAYOUT_PRESETS, openWidget } from '../model/presets';
import {
  layoutLockedAtom,
  terminalLayoutAtom,
  useClassicLayoutAtom,
} from '../model/layout-storage';

const BTN =
  'inline-flex h-7 items-center gap-1.5 px-2 text-xs text-rock/60 hover:text-rock hover:bg-white/5 transition-colors outline-none';

/** Re-render whenever panels are added or removed so the "add widget" list stays accurate. */
function useOpenWidgetIds(api: DockviewApi | null): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!api) return;
    const sync = () => setIds(new Set(api.panels.map(p => p.id)));
    sync();
    const subs = [
      api.onDidAddPanel(sync),
      api.onDidRemovePanel(sync),
      api.onDidLayoutFromJSON(sync),
    ];
    return () => subs.forEach(s => s.dispose());
  }, [api]);
  return ids;
}

export function LayoutToolbar({ api }: { api: DockviewApi | null }) {
  const [locked, setLocked] = useAtom(layoutLockedAtom);
  const setClassic = useSetAtom(useClassicLayoutAtom);
  const setStored = useSetAtom(terminalLayoutAtom);
  const open = useOpenWidgetIds(api);
  const closed = WIDGETS.filter(w => !open.has(w.id));

  const reset = () => {
    if (!api) return;
    DEFAULT_PRESET.apply(api);
    setStored(null);
  };

  return (
    <div className="flex h-8 shrink-0 items-center justify-end gap-0.5 border-b border-outline bg-card px-1">
      <DropdownMenu>
        <DropdownMenuTrigger className={BTN} disabled={!api || closed.length === 0}>
          <Plus className="size-3.5" />
          Add widget
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Widgets</DropdownMenuLabel>
          {closed.map(w => (
            <DropdownMenuItem key={w.id} onSelect={() => api && openWidget(api, w.id)}>
              {w.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={BTN} disabled={!api}>
          <LayoutGrid className="size-3.5" />
          Layout
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Presets</DropdownMenuLabel>
          {LAYOUT_PRESETS.map(p => (
            <DropdownMenuItem key={p.id} onSelect={() => api && p.apply(api)}>
              {p.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={locked} onCheckedChange={v => setLocked(!!v)}>
            Lock layout
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem onSelect={reset}>
            <RotateCcw className="size-3.5" />
            Reset to default
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setClassic(true)}>Use classic layout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        className={BTN}
        onClick={() => setLocked(v => !v)}
        title={locked ? 'Unlock layout' : 'Lock layout'}
        aria-pressed={locked}
      >
        {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
      </button>
    </div>
  );
}
