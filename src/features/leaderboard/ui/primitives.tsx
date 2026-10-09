/**
 * Small layout primitives for the leaderboard, in the terminal's visual
 * language: flat `border-outline` panels, `bg-card` header bars, mono eyebrows.
 */
import { cn } from '@/lib/utils';

/** Shimmer placeholder; static when the user prefers reduced motion. */
export function Bone({ className }: { className?: string }) {
  return <span className={cn('skeleton-bone block motion-reduce:animate-none!', className)} />;
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn('font-mono text-[11px] uppercase tracking-[0.12em] text-rock/50', className)}
    >
      {children}
    </span>
  );
}
