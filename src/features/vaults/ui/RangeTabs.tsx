/** Compact segmented control for picking a chart window. */
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { cn } from '@/lib/utils';

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  className,
  label,
}: {
  value: T;
  options: readonly T[] | { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
  label: string;
}) {
  const items = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <Tabs value={value} onValueChange={v => onChange(v as T)}>
      <TabsList aria-label={label} className={cn('h-8 border border-line', className)}>
        {items.map(o => (
          <TabsTrigger
            key={o.value}
            value={o.value}
            className="border-b-0 px-2.5 py-0 font-mono text-[11px] uppercase tracking-[0.08em]"
          >
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
