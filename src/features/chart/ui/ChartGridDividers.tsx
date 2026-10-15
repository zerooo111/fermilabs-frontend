/**
 * Drag handles between chart panes. The split lives in two CSS variables on
 * the grid's wrapper (--split-x, --split-y, shares of 1): while dragging we
 * write them straight onto the element so React doesn't re-render every pane
 * per pointer move, and hand the final split back on release. Double-click
 * resets a divider to the middle.
 */
import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { clampSplit, DEFAULT_SPLIT, type GridSplit } from '@/features/chart/lib/chart-grid';

type Axis = 'x' | 'y';

interface ChartGridDividersProps {
  /** The element carrying --split-x / --split-y; positions are measured against it. */
  containerRef: RefObject<HTMLDivElement | null>;
  split: GridSplit;
  cols: 1 | 2;
  rows: 1 | 2;
  /** The row divider only spans the right column. */
  rowSplitRightOnly?: boolean;
  onSplitChange: (split: GridSplit) => void;
}

export function ChartGridDividers({
  containerRef,
  split,
  cols,
  rows,
  rowSplitRightOnly,
  onSplitChange,
}: ChartGridDividersProps) {
  const startDrag = useCallback(
    (axis: Axis) => (e: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const rect = container.getBoundingClientRect();
      let value = split[axis];

      const onMove = (ev: PointerEvent) => {
        value = clampSplit(
          axis === 'x'
            ? (ev.clientX - rect.left) / rect.width
            : (ev.clientY - rect.top) / rect.height
        );
        container.style.setProperty(`--split-${axis}`, String(value));
      };
      const onEnd = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
        document.body.style.removeProperty('cursor');
        onSplitChange({ ...split, [axis]: value });
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
      // Keep the resize cursor if the pointer outruns the handle.
      document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    },
    [containerRef, split, onSplitChange]
  );

  const reset = (axis: Axis) => () => onSplitChange({ ...split, [axis]: DEFAULT_SPLIT[axis] });

  const handle =
    'absolute z-20 flex touch-none items-center justify-center select-none ' +
    'after:bg-transparent after:transition-colors hover:after:bg-primary/50 active:after:bg-primary';

  return (
    <>
      {cols === 2 && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize charts horizontally"
          aria-valuenow={Math.round(split.x * 100)}
          title="Drag to resize · double-click to reset"
          onPointerDown={startDrag('x')}
          onDoubleClick={reset('x')}
          className={cn(
            handle,
            'inset-y-0 w-2 -translate-x-1/2 cursor-col-resize after:h-full after:w-px'
          )}
          style={{ left: 'calc(var(--split-x) * 100%)' }}
        />
      )}
      {rows === 2 && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize charts vertically"
          aria-valuenow={Math.round(split.y * 100)}
          title="Drag to resize · double-click to reset"
          onPointerDown={startDrag('y')}
          onDoubleClick={reset('y')}
          className={cn(
            handle,
            'right-0 h-2 -translate-y-1/2 cursor-row-resize after:h-px after:w-full'
          )}
          style={{
            top: 'calc(var(--split-y) * 100%)',
            left: rowSplitRightOnly ? 'calc(var(--split-x) * 100% + 1px)' : 0,
          }}
        />
      )}
    </>
  );
}
