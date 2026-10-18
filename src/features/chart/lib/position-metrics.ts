/**
 * Long / short position plan math, from the drawing's three anchors
 * (entry, target, stop; target and stop share the right edge's time).
 * Mirrors CandleFrame's position-drawing.ts, which the package does not export.
 */
import type { Anchor, Drawing } from 'candleframe/core';

/** Setting sections the Position tab renders. */
export const POSITION_CLAIMS = ['Position', 'Outcome'] as const;

export const isPositionType = (type: string) =>
  type === 'long-position' || type === 'short-position';

/** 1 for a long plan, -1 for a short one. */
export const positionDirection = (type: string) => (type === 'long-position' ? 1 : -1);

export interface PositionMetrics {
  /** Price distance from entry to target, in the trade's favour. */
  reward: number;
  /** Price distance from entry to stop, against the trade. */
  risk: number;
  ratio: number;
  rewardPercent: number;
  riskPercent: number;
  /** Target and stop sit on the correct sides of entry. */
  valid: boolean;
}

export function positionMetrics(type: string, points: readonly Anchor[]): PositionMetrics {
  const [entry, target, stop] = points;
  const direction = positionDirection(type);
  const reward = (target.price - entry.price) * direction;
  const risk = (entry.price - stop.price) * direction;
  const ratio = reward / risk;
  return {
    reward,
    risk,
    ratio,
    rewardPercent: (reward / entry.price) * 100,
    riskPercent: (risk / entry.price) * 100,
    valid: reward > 0 && risk > 0 && Number.isFinite(ratio),
  };
}

/** The target price that gives `ratio` reward / risk for the current entry and stop. */
export function targetForRatio(type: string, entry: number, stop: number, ratio: number) {
  const direction = positionDirection(type);
  const risk = (entry - stop) * direction;
  if (!(risk > 0) || !(ratio > 0)) return null;
  return entry + direction * risk * ratio;
}

/** Plan width in bars of `intervalMs`. */
export const positionBars = (points: readonly Anchor[], intervalMs: number) =>
  Math.abs(points[1].timeMs - points[0].timeMs) / intervalMs;

/** Points with the right edge (target and stop) moved to `bars` bars from entry, keeping its side. */
export function withPositionBars(points: readonly Anchor[], bars: number, intervalMs: number) {
  const next = points.map(point => ({ ...point }));
  const sign = Math.sign(next[1].timeMs - next[0].timeMs) || 1;
  next[1].timeMs = next[0].timeMs + sign * bars * intervalMs;
  next[2].timeMs = next[1].timeMs;
  return next;
}

export const positionSideMessage = (type: Drawing['type']) =>
  positionDirection(type) > 0
    ? 'Place the target above entry and the stop below entry.'
    : 'Place the target below entry and the stop above entry.';
