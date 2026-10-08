/**
 * Compact layout control for the app header: open closed widgets, switch
 * presets, enter/leave edit mode, reset, or fall back to the classic grid.
 * Renders nothing when no dock is mounted (mobile, other routes).
 */
import { useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import type { DockviewApi } from 'dockview-react';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { dockApiAtom } from '../model/dock-api';

/** Re-render whenever panels are added or removed so the widget list stays accurate. */
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

export function LayoutMenu({ className }: { className?: string }) {
  const api = useAtomValue(dockApiAtom);
  const [locked, setLocked] = useAtom(layoutLockedAtom);
  const setClassic = useSetAtom(useClassicLayoutAtom);
  const setStored = useSetAtom(terminalLayoutAtom);
  const open = useOpenWidgetIds(api);
  if (!api) return null;

  const closed = WIDGETS.filter(w => !open.has(w.id));
  const editing = !locked;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex h-8 items-center gap-1.5 border px-2 text-xs transition-colors outline-none',
          editing
            ? 'border-amber-200/60 text-amber-200 hover:bg-amber-200/10'
            : 'border-outline text-rock/70 hover:bg-rock/5 hover:text-rock',
          className
        )}
        title="Layout"
      >
        <LayoutGrid className="size-3.5" />
        {editing ? 'Editing layout' : 'Layout'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuCheckboxItem checked={editing} onCheckedChange={v => setLocked(!v)}>
          Edit layout
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Presets</DropdownMenuLabel>
        {LAYOUT_PRESETS.map(p => (
          <DropdownMenuItem key={p.id} onSelect={() => p.apply(api)}>
            {p.label}
          </DropdownMenuItem>
        ))}
        {closed.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Add widget</DropdownMenuLabel>
            {closed.map(w => (
              <DropdownMenuItem key={w.id} onSelect={() => openWidget(api, w.id)}>
                {w.title}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            DEFAULT_PRESET.apply(api);
            setStored(null);
          }}
        >
          Reset to default
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setClassic(true)}>Use classic layout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
