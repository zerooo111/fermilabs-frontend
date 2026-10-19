/**
 * HTML over CandleFrame's indicator panes: one full-width divider above each
 * pane, collapse and remove buttons in its top-right corner, and a strip
 * above the time axis holding the collapsed ones. CandleFrame can't shrink a pane to its title, so
 * collapsed = hidden: the pane leaves the layout and its chip moves to the
 * strip, which chartTheme(…, paneStrip) makes room for.
 */
import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import type { ResolvedChartTheme } from 'candleframe/chart';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { paneLayout } from '@/features/chart/lib/pane-layout';
import { PANE_STRIP_HEIGHT } from '@/features/chart/lib/chart-settings';
import type { LegendIndicator } from './ChartLegend';
import type { PaneRect } from '@/features/chart/lib/pane-layout';

const BUTTON =
  'flex size-4 items-center justify-center text-rock/50 transition-colors hover:text-rock';

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

interface ChartPaneOverlaysProps {
  host: RefObject<HTMLDivElement | null>;
  /** The theme the engine has, so the layout matches its panes. */
  theme: ResolvedChartTheme;
  indicators: readonly LegendIndicator[];
  onToggle: (id: string, visible: boolean) => void;
  onRemove: (id: string) => void;
}

function ChartPaneOverlaysComponent({
  host,
  theme,
  indicators,
  onToggle,
  onRemove,
}: ChartPaneOverlaysProps) {
  const { width, height } = useSize(host);
  const panes = indicators.filter(i => i.pane === 'separate');
  const collapsed = panes.filter(i => !i.visible);
  const layout =
    width && height
      ? paneLayout(
          width,
          height,
          theme.chart,
          panes.filter(i => i.visible).map(i => i.id)
        )
      : null;

  // The pane under the pointer shows its buttons. The overlay lets pointer
  // events through to the chart, so listen on the pane root, which holds both
  // the chart host and the buttons.
  const [hovered, setHovered] = useState<string | null>(null);
  const rectsRef = useRef<readonly PaneRect[]>([]);
  rectsRef.current = layout?.panes ?? [];
  useEffect(() => {
    const root = host.current?.parentElement;
    if (!root) return;
    const onMove = (e: PointerEvent) => {
      const y = e.clientY - root.getBoundingClientRect().top;
      const pane = rectsRef.current.find(p => y >= p.top && y <= p.top + p.height);
      setHovered(pane?.id ?? null);
    };
    const onLeave = () => setHovered(null);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, [host]);

  if (!layout || !panes.length) return null;
  const byId = new Map(panes.map(i => [i.id, i]));

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {layout.panes.map(pane => {
        const indicator = byId.get(pane.id);
        if (!indicator) return null;
        return (
          <div key={pane.id}>
            {/* CandleFrame draws its own lines in the gap above the pane (two
                above the first one), across the plot only. Paint the gap in
                the chart background and draw one line, in CandleFrame's border
                color, through its middle and across the full width. */}
            <div
              className="absolute left-0 right-0 flex items-center"
              style={{
                top: pane.gap.top,
                height: pane.gap.height,
                backgroundColor: theme.palette.background,
              }}
            >
              <div className="h-px w-full" style={{ backgroundColor: theme.palette.border }} />
            </div>
            <div
              className={cn(
                'absolute flex items-center gap-0.5 border border-outline bg-background/85 px-0.5 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100',
                hovered === pane.id && 'pointer-events-auto opacity-100'
              )}
              style={{ top: pane.top + 1, right: width - layout.left - layout.plotWidth + 4 }}
            >
              <button
                type="button"
                aria-label={`Collapse ${indicator.name}`}
                title="Collapse"
                onClick={() => onToggle(pane.id, false)}
                className={BUTTON}
              >
                <ChevronDown className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${indicator.name}`}
                title="Remove"
                onClick={() => onRemove(pane.id)}
                className={BUTTON}
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        );
      })}

      {collapsed.length > 0 && (
        <div
          className="pointer-events-auto absolute flex items-center gap-1 overflow-hidden border-t border-outline"
          style={{
            left: 0,
            right: 0,
            top: layout.bottom + 3,
            height: PANE_STRIP_HEIGHT,
            paddingLeft: layout.left,
          }}
        >
          {collapsed.map(({ id, name }) => (
            <div
              key={id}
              className="flex h-4 shrink-0 items-center gap-0.5 border border-outline bg-background/85 pl-1 pr-0.5 text-[10px] text-rock/60"
            >
              <button
                type="button"
                aria-label={`Expand ${name}`}
                title="Expand"
                onClick={() => onToggle(id, true)}
                className="flex items-center gap-1 hover:text-rock"
              >
                <ChevronUp className="size-3" />
                {name}
              </button>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                title="Remove"
                onClick={() => onRemove(id)}
                className={BUTTON}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ChartPaneOverlays = memo(ChartPaneOverlaysComponent);
