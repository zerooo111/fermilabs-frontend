/**
 * A live countdown to a moment, ticking every second: `12d 04h 31m 09s`.
 * Each unit keeps two digits so the width holds still while it ticks.
 */
import { useNow } from '../model/useNow';

const pad = (n: number) => String(n).padStart(2, '0');

export function Countdown({ to, className }: { to: number; className?: string }) {
  const now = useNow(1000);
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return (
    <span className={className}>
      {d}d {pad(h)}h {pad(m)}m {pad(s % 60)}s
    </span>
  );
}
