/**
 * Body of the Levels tab: a table of the drawing's levels (show, value,
 * colour, remove), add / reset, then the tool's Levels and Labels settings.
 * `drawing.levels` empty means the tool's defaults, and `levelStyles[i]`
 * styles `levels[i]`, so every edit sends both together as one undo step.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { drawingOption } from 'candleframe/core';
import type { DrawingLevelStyle } from 'candleframe/core';
import { cn } from '@/lib/utils';
import { SECTION_HEADING } from '@/features/chart/lib/drawing-settings';
import {
  LEVEL_MAX,
  LEVEL_MIN,
  LEVEL_STYLES_UNSUPPORTED,
  MAX_DRAWING_LEVELS,
  drawingLevelColors,
  drawingLevelState,
  nextLevel,
  replaced,
  without,
} from '@/features/chart/lib/drawing-levels';
import { ColorPicker } from './ColorPicker';
import { DrawingSettingFields } from './DrawingSettingFields';
import type { DrawingEditorProps } from './types';

const ACTION =
  'h-7 border border-outline px-2 text-[11px] text-rock/70 outline-none transition-colors hover:bg-rock/10 hover:text-rock focus-visible:border-rock/40 disabled:pointer-events-none disabled:opacity-30';

function LevelValue({
  index,
  value,
  onCommit,
}: {
  index: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(next)) return;
    const clamped = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, next));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={`Level ${index + 1} value`}
      data-level-value={index}
      min={LEVEL_MIN}
      max={LEVEL_MAX}
      step="any"
      value={draft ?? String(value)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="h-7 w-0 min-w-0 flex-1 [appearance:textfield] border border-outline bg-background px-1.5 text-right font-mono text-xs text-rock outline-none focus:border-rock/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

function DrawingLevelsEditorComponent({ drawing, tool, update }: DrawingEditorProps) {
  const { levels, looks, customised } = drawingLevelState(drawing);
  const unstyled = LEVEL_STYLES_UNSUPPORTED.has(drawing.type);
  // Where per-level looks are ignored, swatches show the hue the chart draws.
  const colors = drawingLevelColors(drawing, tool, levels, unstyled ? [] : looks);
  const oneColor = drawingOption<boolean>(drawing, tool, 'levelColors') === false;
  const styleHint = unstyled
    ? "CandleFrame doesn't style individual levels on this tool yet"
    : oneColor
      ? 'Turn on Colour each level to pick level colours'
      : undefined;
  const [levelFields, labelFields] = useMemo(() => {
    const settings = tool.settings ?? [];
    return [
      settings.filter(s => s.section === 'Levels'),
      settings.filter(s => s.section === 'Labels'),
    ];
  }, [tool.settings]);

  // Adding a level focuses its value once the new row renders.
  const tableRef = useRef<HTMLDivElement>(null);
  const focusRow = useRef<number | null>(null);
  useEffect(() => {
    if (focusRow.current === null) return;
    const input = tableRef.current?.querySelector<HTMLInputElement>(
      `[data-level-value="${focusRow.current}"]`
    );
    if (!input) return;
    focusRow.current = null;
    input.focus({ preventScroll: true });
    input.select();
  });

  const edit = (nextLevels: number[], nextLooks: DrawingLevelStyle[]) =>
    update({ levels: nextLevels, levelStyles: nextLooks });

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className={cn(SECTION_HEADING, 'mb-1')}>Levels</legend>
        <div
          ref={tableRef}
          role="group"
          aria-label="Fibonacci levels"
          className="grid grid-cols-2 gap-x-3 gap-y-1"
        >
          {levels.map((level, i) => {
            const look = looks[i];
            const shown = look.visible !== false;
            return (
              <div key={i} className="flex min-w-0 items-center gap-1">
                <span title={unstyled ? styleHint : undefined} className="inline-flex shrink-0">
                  <input
                    type="checkbox"
                    aria-label={`Show level ${i + 1}`}
                    checked={unstyled || shown}
                    disabled={unstyled}
                    onChange={e => {
                      const next = { ...look };
                      if (e.target.checked) delete next.visible;
                      else next.visible = false;
                      edit(levels, replaced(looks, i, next));
                    }}
                    className="size-3.5 accent-[var(--color-primary)] disabled:opacity-30"
                  />
                </span>
                <LevelValue
                  index={i}
                  value={level}
                  onCommit={value => edit(replaced(levels, i, value), looks)}
                />
                <span title={styleHint}>
                  <ColorPicker
                    label={`Level ${i + 1} colour`}
                    value={oneColor ? drawing.style.color : colors[i]}
                    disabled={unstyled || oneColor}
                    onChange={color => edit(levels, replaced(looks, i, { ...look, color }))}
                    className={cn(!unstyled && !shown && 'opacity-50')}
                  />
                </span>
                <button
                  type="button"
                  aria-label={`Remove level ${i + 1}`}
                  title="Remove"
                  disabled={levels.length <= 1}
                  onClick={() => edit(without(levels, i), without(looks, i))}
                  className="inline-flex size-5 shrink-0 items-center justify-center text-rock/40 outline-none transition-colors hover:text-danger focus-visible:text-danger disabled:pointer-events-none disabled:opacity-30"
                >
                  <X className="size-3" strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={ACTION}
            disabled={levels.length >= MAX_DRAWING_LEVELS}
            title={
              levels.length >= MAX_DRAWING_LEVELS ? `Up to ${MAX_DRAWING_LEVELS} levels` : undefined
            }
            onClick={() => {
              focusRow.current = levels.length;
              edit([...levels, nextLevel(levels)], looks);
            }}
          >
            Add level
          </button>
          <button
            type="button"
            className={ACTION}
            disabled={!customised}
            onClick={() => edit([], [])}
          >
            Reset to defaults
          </button>
        </div>
        {levelFields.length > 0 && (
          <DrawingSettingFields fields={levelFields} drawing={drawing} update={update} flat />
        )}
      </fieldset>
      {labelFields.length > 0 && (
        <DrawingSettingFields fields={labelFields} drawing={drawing} update={update} />
      )}
    </div>
  );
}

export const DrawingLevelsEditor = memo(DrawingLevelsEditorComponent);
