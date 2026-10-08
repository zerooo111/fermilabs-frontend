/**
 * Tab strip motion
 * Two shared indicators for any row of tabs or toggles:
 *   - a hover pill that follows the cursor from tab to tab
 *   - an active line (or fill) that slides to the selected tab
 * Both are `layoutId` elements, so motion morphs one element between
 * positions instead of fading two.
 *
 * Usage:
 *   <TabStrip id="ticket-order-type" className="flex">
 *     {tabs.map(t => <TabStripItem key={t} value={t} active={t === current} onSelect=... />)}
 *   </TabStrip>
 *
 * Or, for custom markup, wrap your own button with `useTabStripItem(value)`
 * and render <TabHover /> and <TabActive /> inside it.
 */
import {
  createContext,
  useContext,
  useId,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { springs } from '@/shared/lib/motion';

interface StripContext {
  id: string;
  hovered: string | null;
  setHovered: (value: string | null) => void;
  active?: string;
}

const Ctx = createContext<StripContext | null>(null);

interface TabStripProps extends HTMLAttributes<HTMLDivElement> {
  /** Stable id; indicators are keyed on it so two strips never swap pills. Defaults to a React id. */
  id?: string;
  /** Selected value, if the strip (rather than each item) knows it. */
  active?: string;
}

export function TabStrip({
  id,
  active,
  className,
  onMouseLeave,
  children,
  ...rest
}: TabStripProps) {
  const reactId = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <Ctx.Provider value={{ id: id ?? reactId, hovered, setHovered, active }}>
      <div
        className={cn('relative', className)}
        onMouseLeave={e => {
          setHovered(null);
          onMouseLeave?.(e);
        }}
        {...rest}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** Clear the hover pill, for a list element that isn't the <TabStrip> div itself. */
export function useTabStripReset() {
  const ctx = useContext(Ctx);
  return () => ctx?.setHovered(null);
}

/** Hook the hover tracking into your own element. Spread `bind` onto the button. */
export function useTabStripItem(value: string) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTabStripItem must be used inside <TabStrip>');
  return {
    stripId: ctx.id,
    isHovered: ctx.hovered === value,
    isActive: ctx.active === value,
    bind: {
      onMouseEnter: () => ctx.setHovered(value),
      onFocus: () => ctx.setHovered(value),
    },
  };
}

/** The pill that follows the cursor. Render inside a `relative isolate` item. */
export function TabHover({
  show,
  stripId,
  className,
}: {
  show: boolean;
  stripId: string;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          layoutId={`${stripId}-hover`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.snappy}
          className={cn('pointer-events-none absolute inset-0 -z-10 bg-rock/6', className)}
        />
      )}
    </AnimatePresence>
  );
}

/** The selected marker. Defaults to a 1px underline; pass a className for a fill. */
export function TabActive({
  show,
  stripId,
  className,
}: {
  show: boolean;
  stripId: string;
  className?: string;
}) {
  if (!show) return null;
  return (
    <motion.span
      layoutId={`${stripId}-active`}
      transition={springs.snappy}
      className={cn('pointer-events-none absolute inset-x-0 bottom-0 z-0 h-px bg-rock', className)}
    />
  );
}

interface TabStripItemProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  value: string;
  active?: boolean;
  onSelect?: (value: string) => void;
  activeClassName?: string;
  children: ReactNode;
}

/** A ready-made tab button with both indicators wired up. */
export function TabStripItem({
  value,
  active,
  onSelect,
  className,
  activeClassName,
  children,
  ...rest
}: TabStripItemProps) {
  const item = useTabStripItem(value);
  const isActive = active ?? item.isActive;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect?.(value)}
      className={cn(
        'relative isolate inline-flex h-8 items-center px-3 text-xs tracking-[0.01em] whitespace-nowrap transition-colors duration-150 outline-none',
        isActive ? 'text-rock' : 'text-rock/50 hover:text-rock/85',
        className
      )}
      {...item.bind}
      {...rest}
    >
      <TabHover show={item.isHovered} stripId={item.stripId} />
      <TabActive show={isActive} stripId={item.stripId} className={activeClassName} />
      {children}
    </button>
  );
}
