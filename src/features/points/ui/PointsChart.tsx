/**
 * A wallet's points over time: the running total as a smooth curve, from the
 * start of the program to now. The curve is monotone, so it never dips below
 * a total or overshoots the next one. Hover (or touch) snaps to the nearest
 * data point and shows its date and total.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { PointsEntry } from '../api/pointsClient';
import { dateUtc, points } from '../model/format';

/** Used until the container is measured, and as the floor. */
const MIN_HEIGHT = 200;
const PAD = { top: 16, right: 8, bottom: 24, left: 8 };

interface Point {
  t: number;
  total: number;
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({
        width: Math.round(e.contentRect.width),
        height: Math.round(e.contentRect.height),
      })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * Monotone cubic path through pixel points with increasing x (Fritsch-Carlson
 * tangents, as d3's curveMonotoneX): smooth, and flat wherever the data is.
 */
function monotonePath(p: [number, number][]): string {
  const n = p.length;
  if (n === 0) return '';
  if (n === 2) return `M${p[0][0]},${p[0][1]}L${p[1][0]},${p[1][1]}`;
  if (n === 1) return `M${p[0][0]},${p[0][1]}`;
  const slope = (i: number) => (p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0] || 1);
  const m = new Array<number>(n);
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope(i - 1);
    const s1 = slope(i);
    const h0 = p[i][0] - p[i - 1][0];
    const h1 = p[i + 1][0] - p[i][0];
    const mid = (s0 * h1 + s1 * h0) / (h0 + h1);
    m[i] =
      (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(mid));
  }
  // End tangents from the neighbouring one, so the ends don't overshoot either.
  m[0] = (3 * slope(0) - m[1]) / 2;
  m[n - 1] = (3 * slope(n - 2) - m[n - 2]) / 2;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1][0] - p[i][0]) / 3;
    d += `C${p[i][0] + h},${p[i][1] + h * m[i]} ${p[i + 1][0] - h},${p[i + 1][1] - h * m[i + 1]} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return d;
}

export function PointsChart({ entries, startMs }: { entries: PointsEntry[]; startMs: number }) {
  const [ref, { width, height }] = useSize();
  // Fills its container's height, so it lines up with whatever sits beside it.
  const HEIGHT = Math.max(MIN_HEIGHT, height);
  const [hover, setHover] = useState<number | null>(null);

  // The total after each entry, from 0 at the start to the total now.
  const { data, from, to, max } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.occurred_at_ms - b.occurred_at_ms);
    const from = Math.min(startMs, sorted[0]?.occurred_at_ms ?? startMs);
    const to = Math.max(Date.now(), sorted.at(-1)?.occurred_at_ms ?? from + 1);
    let total = 0;
    const data: Point[] = [{ t: from, total: 0 }];
    for (const e of sorted) {
      total += e.points;
      // Entries at the same moment collapse into one point.
      if (data.at(-1)!.t === e.occurred_at_ms) data.at(-1)!.total = total;
      else data.push({ t: e.occurred_at_ms, total });
    }
    if (data.at(-1)!.t < to) data.push({ t: to, total });
    const max = Math.max(1, ...data.map(s => s.total));
    return { data, from, to, max };
  }, [entries, startMs]);

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - from) / (to - from)) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.max(0, v) / max) * plotH;

  const line = monotonePath(data.map(d => [x(d.t), y(d.total)]));
  const area = `${line}V${y(0)}H${x(from)}Z`;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let nearest = 0;
    data.forEach((d, i) => {
      if (Math.abs(x(d.t) - px) < Math.abs(x(data[nearest].t) - px)) nearest = i;
    });
    setHover(nearest);
  };

  const h = hover !== null ? data[hover] : null;
  const tipBelow = h !== null && y(h.total) < 44;
  const last = data.at(-1)!;

  return (
    <div ref={ref} className="relative h-full min-h-[200px]">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Points over time, now ${points(last.total)}`}
        >
          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--color-rock)"
            strokeOpacity="0.15"
          />
          <path d={area} fill="var(--color-lichen)" fillOpacity="0.12" />
          <path d={line} fill="none" stroke="var(--color-lichen)" strokeWidth="2" />
          {h && (
            <line
              x1={x(h.t)}
              x2={x(h.t)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--color-rock)"
              strokeOpacity="0.35"
              strokeDasharray="2 3"
            />
          )}
          <circle
            cx={x((h ?? last).t)}
            cy={y((h ?? last).total)}
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
        </svg>
      )}
      {h && (
        <div
          className={`pointer-events-none absolute -translate-x-1/2 border border-rock/15 bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap ${tipBelow ? '' : '-translate-y-full'}`}
          style={{
            left: Math.min(width - 70, Math.max(70, x(h.t))),
            // Above the point, or below it when there's no room above.
            top: tipBelow ? y(h.total) + 10 : y(h.total) - 10,
          }}
        >
          <span className="text-rock/60">{h.t === last.t ? 'Today' : dateUtc(h.t)}</span>
          <span className="ml-2 text-rock">
            <span className="font-mono">{points(h.total)}</span> pts
          </span>
        </div>
      )}
    </div>
  );
}
