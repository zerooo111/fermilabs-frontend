/**
 * Swatch button that opens a palette of drawing colors plus a custom picker.
 * Shared by the toolbar and the settings tabs. Six-digit hex in and out, as
 * CandleFrame validates drawing colors.
 */
import { memo, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { cn } from '@/lib/utils';
import { DRAWING_COLORS, toHex6 } from '@/features/chart/lib/drawing-colors';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  className?: string;
}

function ColorPickerComponent({ label, value, onChange, disabled, className }: ColorPickerProps) {
  const customRef = useRef<HTMLInputElement>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  const current = toHex6(value || '#fde68a');

  // React's onChange on a color input fires on every drag step; commit once,
  // when the native picker closes, so each pick is one undo step.
  useEffect(() => {
    const input = customRef.current;
    if (!input) return;
    const commit = () => latest.current(input.value);
    input.addEventListener('change', commit);
    return () => input.removeEventListener('change', commit);
  });

  return (
    <Popover modal={false}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex size-7 items-center justify-center outline-none transition-colors hover:bg-rock/10 disabled:pointer-events-none disabled:opacity-30 data-[state=open]:bg-rock/10',
          className
        )}
      >
        <span className="size-3.5 border border-rock/30" style={{ background: current }} />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        // Flips below the swatch near the top of the window.
        collisionPadding={8}
        className="w-auto p-2"
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="grid grid-cols-6 gap-1">
          {DRAWING_COLORS.map(color => (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={color === current}
              onClick={() => onChange(color)}
              className={cn(
                'size-5 border border-rock/20 outline-none transition-transform hover:scale-110 focus-visible:ring-1 focus-visible:ring-primary',
                color === current && 'ring-1 ring-rock ring-offset-1 ring-offset-surface'
              )}
              style={{ background: color }}
            />
          ))}
        </div>
        <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 border-t border-outline pt-2 text-[11px] text-rock/60 hover:text-rock">
          Custom
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-rock/50">
            {current}
            <input
              ref={customRef}
              type="color"
              defaultValue={current}
              key={current}
              className="size-5 cursor-pointer border border-rock/30 bg-transparent p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
            />
          </span>
        </label>
      </PopoverContent>
    </Popover>
  );
}

export const ColorPicker = memo(ColorPickerComponent);
