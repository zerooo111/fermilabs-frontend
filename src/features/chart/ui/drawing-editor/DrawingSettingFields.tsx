/**
 * Form fields for a list of CandleFrame `DrawingSetting`s, grouped under their
 * `section` headings. Values live in `drawing.options`; a missing value shows
 * the setting's default. Every settings tab renders its tool settings with
 * this, so fields look and commit the same everywhere.
 */
import { memo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Drawing, DrawingOptionValue, DrawingSetting } from 'candleframe/core';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/lib/utils';
import {
  SECTION_HEADING,
  groupSettings,
  settingValue,
} from '@/features/chart/lib/drawing-settings';
import { ColorPicker } from './ColorPicker';
import type { DrawingEditorProps } from './types';

export const SETTING_ROW = 'flex min-h-7 items-center justify-between gap-3 text-xs text-rock/70';

/** Decimals in `step`, so typed values don't carry float noise like 0.30000000000000004. */
function stepDecimals(step: number | undefined) {
  if (!step) return 6;
  const [, fraction = ''] = String(step).split('.');
  return fraction.length;
}

interface DrawingNumberInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (value: number) => void;
}

/** Number box that commits on blur or Enter, clamped to `min`..`max`; Escape reverts. */
export function DrawingNumberInput({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: DrawingNumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(next)) return;
    const clamped = Number(Math.min(max, Math.max(min, next)).toFixed(stepDecimals(step)));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={min}
      max={max}
      step={step ?? 'any'}
      value={draft ?? String(value)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="h-7 w-20 border border-outline bg-background px-2 text-right font-mono text-xs text-rock outline-none focus:border-rock/40"
    />
  );
}

interface DrawingSettingFieldProps {
  field: DrawingSetting;
  drawing: Drawing;
  update: DrawingEditorProps['update'];
}

/** One setting's row: label and control. */
export function DrawingSettingField({ field, drawing, update }: DrawingSettingFieldProps) {
  const value = settingValue(drawing, field);
  const set = (next: DrawingOptionValue) => update({ options: { [field.key]: next } });

  if (field.kind === 'boolean') {
    return (
      <label className={cn(SETTING_ROW, 'cursor-pointer justify-start hover:text-rock')}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={e => set(e.target.checked)}
          className="size-3.5 accent-[var(--color-primary)]"
        />
        {field.label}
      </label>
    );
  }
  if (field.kind === 'select') {
    return (
      <div className={SETTING_ROW}>
        <span>{field.label}</span>
        <Select value={String(value)} onValueChange={set}>
          <SelectTrigger size="sm" aria-label={field.label} className="h-7 min-w-28 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.choices.map(choice => (
              <SelectItem key={choice.value} value={choice.value} className="text-xs">
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.kind === 'color') {
    // A blank default follows the drawing's color until a color is picked;
    // the reset button goes back to following it.
    const follows = field.default === '';
    return (
      <div className={SETTING_ROW}>
        <span>{field.label}</span>
        <span className="flex items-center">
          {follows && value !== '' && (
            <button
              type="button"
              aria-label={`${field.label}: use drawing color`}
              title="Use drawing color"
              onClick={() => set('')}
              className="inline-flex size-7 items-center justify-center text-rock/40 outline-none transition-colors hover:bg-rock/10 hover:text-rock focus-visible:text-rock"
            >
              <RotateCcw className="size-3" strokeWidth={1.75} />
            </button>
          )}
          <ColorPicker
            label={field.label}
            value={String(value) || drawing.style.color}
            onChange={set}
          />
        </span>
      </div>
    );
  }
  return (
    <div className={SETTING_ROW}>
      <span>{field.label}</span>
      <DrawingNumberInput
        label={field.label}
        value={Number(value)}
        min={field.min}
        max={field.max}
        step={field.step}
        onCommit={set}
      />
    </div>
  );
}

interface DrawingSettingFieldsProps {
  fields: readonly DrawingSetting[];
  drawing: Drawing;
  update: DrawingEditorProps['update'];
  /** Hide section headings, for a tab that is itself one section. */
  flat?: boolean;
}

function DrawingSettingFieldsComponent({
  fields,
  drawing,
  update,
  flat,
}: DrawingSettingFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      {groupSettings(fields).map(({ section, fields: group }, i) => (
        <fieldset key={`${section ?? ''}-${i}`} className="flex flex-col gap-0.5">
          {!flat && section && <legend className={cn(SECTION_HEADING, 'mb-1')}>{section}</legend>}
          {group.map(field => (
            <DrawingSettingField key={field.key} field={field} drawing={drawing} update={update} />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

export const DrawingSettingFields = memo(DrawingSettingFieldsComponent);
