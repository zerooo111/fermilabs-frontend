/**
 * A points total that counts up from zero when it first shows, like an arcade
 * score. Reduced motion shows the final number straight away.
 */
import { useEffect, useState } from 'react';
import { points } from '../model/format';

const DURATION_MS = 900;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ScoreCount({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      setShown(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  // The final value carries the decimals; mid-count shows whole numbers.
  const text = shown === value ? points(value) : points(Math.round(shown));
  return (
    <span className={className} aria-label={points(value)}>
      <span aria-hidden>{text}</span>
    </span>
  );
}
