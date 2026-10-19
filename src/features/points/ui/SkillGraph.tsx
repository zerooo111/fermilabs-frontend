/**
 * Where a wallet's points came from, as a skill graph: one axis per category,
 * like a game character's stats. Each axis is the category's share of the
 * wallet's best category, square-rooted so small categories still show.
 * Hovering (or focusing) an axis shows its points.
 */
import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { PointsAccount, PointsCategory } from '../api/pointsClient';
import { CATEGORY_LABELS, CATEGORY_ORDER, points } from '../model/format';

const SIZE = 360;
const C = SIZE / 2;
const R = 112;
const RINGS = [0.25, 0.5, 0.75, 1];
const FLOOR = 0.08;

/** Axis i, from the top, clockwise. */
function at(i: number, n: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

const pts = (xs: [number, number][]) => xs.map(([x, y]) => `${x},${y}`).join(' ');

export function SkillGraph({ account }: { account: PointsAccount }) {
  const [active, setActive] = useState<PointsCategory | null>(null);
  const n = CATEGORY_ORDER.length;
  const values = CATEGORY_ORDER.map(c => Math.max(0, account.by_category[c] ?? 0));
  const max = Math.max(1, ...values);
  // A small floor keeps the shape a polygon when only one category has
  // points; the labels still say 0.
  const level = (v: number) => FLOOR + (1 - FLOOR) * Math.sqrt(v / max);
  const shape = values.map((v, i) => at(i, n, R * level(v)));

  return (
    <div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto block w-full max-w-sm overflow-visible"
        role="img"
        aria-label={`Points by category: ${CATEGORY_ORDER.map((c, i) => `${CATEGORY_LABELS[c]} ${points(values[i])}`).join(', ')}`}
      >
        {/* Rings and spokes */}
        {RINGS.map(r => (
          <polygon
            key={r}
            points={pts(CATEGORY_ORDER.map((_, i) => at(i, n, R * r)))}
            fill="none"
            stroke="var(--color-rock)"
            strokeOpacity={r === 1 ? 0.2 : 0.08}
          />
        ))}
        {CATEGORY_ORDER.map((c, i) => {
          const [x, y] = at(i, n, R);
          return (
            <line
              key={c}
              x1={C}
              y1={C}
              x2={x}
              y2={y}
              stroke="var(--color-rock)"
              strokeOpacity={active === c ? 0.35 : 0.08}
            />
          );
        })}

        {/* The wallet's shape */}
        <polygon
          points={pts(shape)}
          fill="var(--color-lichen)"
          fillOpacity="0.22"
          stroke="var(--color-lichen)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {shape.map(([x, y], i) =>
          values[i] > 0 ? (
            <circle
              key={CATEGORY_ORDER[i]}
              cx={x}
              cy={y}
              r={active === CATEGORY_ORDER[i] ? 6 : 4}
              fill="var(--color-lichen)"
              stroke="var(--color-background)"
              strokeWidth="2"
            />
          ) : null
        )}

        {/* Labels, which double as the hover targets */}
        {CATEGORY_ORDER.map((c, i) => {
          const [x, y] = at(i, n, R + 30);
          const anchor = Math.abs(x - C) < 4 ? 'middle' : x > C ? 'start' : 'end';
          const on = values[i] > 0;
          return (
            <g
              key={c}
              tabIndex={0}
              onPointerEnter={() => setActive(c)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(c)}
              onBlur={() => setActive(null)}
              className="cursor-default outline-none"
            >
              <circle cx={x} cy={y} r={26} fill="transparent" />
              <text
                x={x}
                y={y - 2}
                textAnchor={anchor}
                className={cn(
                  'text-[13px] transition-colors',
                  on || active === c ? 'fill-rock' : 'fill-rock/40'
                )}
              >
                {CATEGORY_LABELS[c]}
              </text>
              <text
                x={x}
                y={y + 14}
                textAnchor={anchor}
                className={cn('font-mono text-[12px]', on ? 'fill-lichen' : 'fill-rock/30')}
              >
                {active === c || on ? points(values[i]) : '0'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
