import { cn } from '@/lib/utils';
import { healthTone } from '@/shared/lib/account-health';

/** Segmented health bar; each segment fills in turn. Empty when value is null. */
export function HealthBar({
  value,
  segments = 5,
  className,
}: {
  value: number | null;
  segments?: number;
  className?: string;
}) {
  const pct = value ?? 0;
  const size = 100 / segments;
  const { bar } = healthTone(pct);
  return (
    <div
      role="meter"
      aria-label="Account health"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(pct)}
      className={cn('flex gap-1', className)}
    >
      {Array.from({ length: segments }, (_, i) => {
        const fill = Math.max(0, Math.min(1, (pct - i * size) / size));
        return (
          <div key={i} className="h-1.5 flex-1 overflow-hidden bg-rock/10">
            <div
              className={cn('h-full transition-[width] duration-300', bar)}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
