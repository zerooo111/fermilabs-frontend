/**
 * Segmented control
 * A single choice from a few options, drawn as ruled cells: a 1px rock/15
 * frame with 1px rules between cells. The chosen cell is lifted with a rock
 * tint and full-strength ink; no accent colour, so it stays quiet.
 *
 * Keyboard: it is one tab stop (radiogroup); arrow keys move and select.
 */
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name and tooltip; needed when the label is an icon. */
  title?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  'aria-label': string;
  /** Mono for data (timeframes, sizes); sans for words. */
  mono?: boolean;
  className?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  mono,
  className,
  ...aria
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={aria['aria-label']}
      className={cn('flex gap-px border border-rock/15 bg-rock/15', className)}
    >
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.title}
            title={option.title}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cn(
              'flex h-6 min-w-7 items-center justify-center bg-background px-2 text-xs transition-colors',
              'focus-visible:z-10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-200',
              mono && 'font-mono',
              checked
                ? 'bg-[color-mix(in_srgb,var(--color-rock)_14%,var(--color-background))] text-rock'
                : 'text-rock/45 hover:text-rock/80'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
