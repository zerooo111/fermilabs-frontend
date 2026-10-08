/**
 * DockTab
 * Custom dockview tab so the dock strips get the same shared hover pill and
 * sliding active line as every other tab row. Hover is tracked per group in
 * an atom, since sibling tabs are separate React subtrees under the dock.
 */
import { useEffect, useState } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { AnimatePresence, motion } from 'motion/react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/shared/lib/motion';
import { layoutLockedAtom } from '../model/layout-storage';

/** `${groupId}:${panelId}` of the tab under the cursor, or null. */
const hoveredDockTabAtom = atom<string | null>(null);

export function DockTab({ api }: IDockviewPanelHeaderProps) {
  const [hovered, setHovered] = useAtom(hoveredDockTabAtom);
  const locked = useAtomValue(layoutLockedAtom);
  // Each group keeps its own selected tab. `api.isActive` is dock-wide (only
  // the focused group's tab), which would clear the line in every other group.
  const [active, setActive] = useState(api.group.activePanel?.id === api.id);
  const [title, setTitle] = useState(api.title ?? api.id);
  const [groupId, setGroupId] = useState(api.group.id);

  useEffect(() => {
    const subs = [
      api.onDidTitleChange(e => setTitle(e.title)),
      api.onDidGroupChange(() => setGroupId(api.group.id)),
    ];
    return () => subs.forEach(s => s.dispose());
  }, [api]);

  useEffect(() => {
    const group = api.group;
    setActive(group.activePanel?.id === api.id);
    const sub = group.api.onDidActivePanelChange(e => setActive(e.panel?.id === api.id));
    return () => sub.dispose();
  }, [api, groupId]);

  const key = `${groupId}:${api.id}`;
  const isHovered = hovered === key;

  return (
    <div
      className={cn(
        'relative isolate flex h-full items-center gap-1.5 px-3 text-[12px] tracking-[0.01em] transition-colors duration-150',
        active ? 'text-rock' : 'text-rock/50 hover:text-rock/85'
      )}
      onMouseEnter={() => setHovered(key)}
      onMouseLeave={() => setHovered(h => (h === key ? null : h))}
    >
      <AnimatePresence>
        {isHovered && !active && (
          <motion.span
            layoutId={`dock-${groupId}-hover`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.snappy}
            className="pointer-events-none absolute inset-0 -z-10 bg-rock/6"
          />
        )}
      </AnimatePresence>
      {active && (
        <motion.span
          layoutId={`dock-${groupId}-active`}
          transition={springs.snappy}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-rock"
        />
      )}
      <span className="whitespace-nowrap">{title}</span>
      {!locked && (
        <button
          type="button"
          aria-label={`Close ${title}`}
          onClick={e => {
            e.stopPropagation();
            api.close();
          }}
          onMouseDown={e => e.stopPropagation()}
          className="-mr-1 inline-flex size-4 items-center justify-center text-rock/50 hover:text-rock"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
