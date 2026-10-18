/**
 * The Style tab's form: every tool setting no other tab shows, like
 * CandleFrame's `renderOptions`, plus the drawing's fill opacity and label font
 * size for tools that paint fills or text. Fill opacity sits with the tool's
 * background settings and font size with its labels, or in their own group
 * when the tool has none.
 */
import { memo, useRef, useState, type ReactNode } from 'react';
import type { DrawingSetting } from 'candleframe/core';
import { Slider } from '@/shared/ui/slider';
import { cn } from '@/lib/utils';
import {
  FILL_OPACITY_RANGE,
  FONT_SIZE_RANGE,
  SECTION_HEADING,
  drawsFill,
  groupSettings,
} from '@/features/chart/lib/drawing-settings';
import { DrawingNumberInput, DrawingSettingField, SETTING_ROW } from './DrawingSettingFields';
import { ownSettings, showsFontSize } from './style-rules';
import type { DrawingEditorProps } from './types';

/** Settings whose fill opacity applies; the opacity field follows them. */
const FILL_KEYS = new Set(['background', 'backgroundColor', 'bandFill']);

/** Section headings that take the font size field. */
const LABEL_SECTIONS = new Set(['Labels', 'Text']);

function FillOpacityField({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  // Local while the pointer drags; one commit when it lets go. Keys commit
  // each step directly (Radix reports their commit before the change).
  const [drag, setDrag] = useState<number | null>(null);
  const dragging = useRef<number | null>(null);
  const shown = drag ?? value;
  const commit = (next: number) => {
    dragging.current = null;
    setDrag(null);
    if (next !== value) onCommit(next);
  };
  return (
    <div className={SETTING_ROW}>
      <span className="shrink-0">Fill opacity</span>
      <span className="flex w-40 items-center gap-2">
        <Slider
          aria-label="Fill opacity"
          min={FILL_OPACITY_RANGE.min}
          max={FILL_OPACITY_RANGE.max}
          step={0.01}
          value={[shown]}
          onPointerDown={() => (dragging.current = value)}
          onValueChange={([v]) => {
            if (dragging.current === null) return;
            dragging.current = v;
            setDrag(v);
          }}
          onValueCommit={([v]) => commit(v)}
          // Ends a drag Radix reports no commit for, such as one back to its start.
          onLostPointerCapture={() => dragging.current !== null && commit(dragging.current)}
          className="[&_[data-slot=slider-thumb]]:size-3"
        />
        <span className="w-9 shrink-0 text-right font-mono text-[11px] text-rock">
          {Math.round(shown * 100)}%
        </span>
      </span>
    </div>
  );
}

function Group({ title, children }: { title: string | undefined; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-0.5">
      {title && <legend className={cn(SECTION_HEADING, 'mb-1')}>{title}</legend>}
      {children}
    </fieldset>
  );
}

function StyleFormComponent({ drawing, tool, update, claimed }: DrawingEditorProps) {
  const groups = groupSettings(ownSettings(tool, claimed));
  const { style } = drawing;

  const fillField = drawsFill(tool.type) && (
    <FillOpacityField
      key="fill-opacity"
      value={style.fillOpacity}
      onCommit={fillOpacity => update({ style: { fillOpacity } })}
    />
  );
  const fontField = showsFontSize(tool, drawing) && (
    <div key="font-size" className={SETTING_ROW}>
      <span>Font size</span>
      <DrawingNumberInput
        label="Font size"
        value={style.fontSize}
        min={FONT_SIZE_RANGE.min}
        max={FONT_SIZE_RANGE.max}
        step={1}
        onCommit={fontSize => update({ style: { fontSize } })}
      />
    </div>
  );

  // Where each style field goes: after the last fill setting, or first in a labels group.
  const fillGroup = fillField
    ? groups.findIndex(g => g.fields.some(f => FILL_KEYS.has(f.key)))
    : -1;
  const fontGroup = fontField
    ? groups.findIndex(g => g.section && LABEL_SECTIONS.has(g.section))
    : -1;

  const rows = (fields: DrawingSetting[], index: number) => {
    const out: ReactNode[] = fields.map(field => (
      <DrawingSettingField key={field.key} field={field} drawing={drawing} update={update} />
    ));
    if (index === fillGroup) {
      const last = fields.findLastIndex(f => FILL_KEYS.has(f.key));
      out.splice(last + 1, 0, fillField);
    }
    if (index === fontGroup) out.unshift(fontField);
    return out;
  };

  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ section, fields }, i) => (
        <Group key={`${section ?? ''}-${i}`} title={section}>
          {rows(fields, i)}
        </Group>
      ))}
      {fillField && fillGroup < 0 && <Group title="Fill">{fillField}</Group>}
      {fontField && fontGroup < 0 && <Group title="Labels">{fontField}</Group>}
    </div>
  );
}

export const StyleForm = memo(StyleFormComponent);
