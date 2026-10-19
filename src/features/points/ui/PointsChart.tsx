/**
 * A wallet's points over time: the running total as a step line, from the
 * start of the program to now. Hover (or touch) shows the total on that day.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { PointsEntry } from '../api/pointsClient';
import { dateUtc, points } from '../model/format';

const HEIGHT = 168;
const PAD = { top: 16, right: 8, bottom: 24, left: 8 };

interface Step {
  t: number;
  total: number;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function PointsChart({ entries, startMs }: { entries: PointsEntry[]; startMs: number }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const { steps, from, to, max } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.occurred_at_ms - b.occurred_at_ms);
    const from = Math.min(startMs, sorted[0]?.occurred_at_ms ?? startMs);
    const to = Math.max(Date.now(), sorted.at(-1)?.occurred_at_ms ?? from + 1);
    let total = 0;
    const steps: Step[] = [{ t: from, total: 0 }];
    for (const e of sorted) {
      total += e.points;
      steps.push({ t: e.occurred_at_ms, total });
    }
    const max = Math.max(1, ...steps.map(s => s.total));
    return { steps, from, to, max };
  }, [entries, startMs]);

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - from) / (to - from)) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.max(0, v) / max) * plotH;

  // Step-after path: flat until each entry, then up (or down) to the new total.
  let line = `M${x(steps[0].t)},${y(0)}`;
  for (let i = 1; i < steps.length; i++) {
    line += `H${x(steps[i].t)}V${y(steps[i].total)}`;
  }
  line += `H${x(to)}`;
  const area = `${line}V${y(0)}H${x(from)}Z`;

  const totalAt = (t: number) => {
    let v = 0;
    for (const s of steps) if (s.t <= t) v = s.total;
    return v;
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.min(PAD.left + plotW, Math.max(PAD.left, e.clientX - rect.left));
    setHover(from + ((px - PAD.left) / plotW) * (to - from));
  };

  const hx = hover !== null ? x(hover) : null;
  const hv = hover !== null ? totalAt(hover) : null;

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Points over time, now ${points(steps.at(-1)!.total)}`}
        >
          <defs>
            <linearGradient id="points-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--color-lichen)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--color-lichen)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--color-rock)"
            strokeOpacity="0.15"
          />
          <path d={area} fill="url(#points-area)" />
          <path
            d={line}
            fill="none"
            stroke="var(--color-lichen)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle
            cx={x(to)}
            cy={y(steps.at(-1)!.total)}
            r="4"
            fill="var(--color-lichen)"
            stroke="var(--color-background)"
            strokeWidth="2"
          />
          <text x={PAD.left} y={HEIGHT - 6} className="fill-rock/50 text-[11px]">
            {dateUtc(from)}
          </text>
          <text
            x={PAD.left + plotW}
            y={HEIGHT - 6}
            textAnchor="end"
            className="fill-rock/50 text-[11px]"
          >
            Today
          </text>
          {hx !== null && (
            <line
              x1={hx}
              x2={hx}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--color-rock)"
              strokeOpacity="0.35"
              strokeDasharray="2 3"
            />
          )}
        </svg>
      )}
      {hx !== null && hv !== null && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 border border-rock/15 bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap"
          style={{ left: Math.min(width - 60, Math.max(60, hx)) }}
        >
          <span className="text-rock/60">{dateUtc(hover)}</span>
          <span className="ml-2 tabular-nums text-rock">{points(hv)} pts</span>
        </div>
      )}
    </div>
  );
}
