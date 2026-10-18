/**
 * Body of the Text tab: the drawing's text, its font size and the tool's
 * `Text` settings (bold, italic, border, wrap width, header row). Typing stays
 * local until blur or Cmd/Ctrl+Enter, so one text edit is one undo step, like
 * CandleFrame's text editor.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { SECTION_HEADING } from '@/features/chart/lib/drawing-settings';
import {
  FONT_MAX,
  FONT_MIN,
  TEXT_LIMIT,
  fontSizeFromDraft,
  textSettings,
} from '@/features/chart/lib/drawing-text';
import { DrawingSettingFields } from './DrawingSettingFields';
import type { DrawingEditorProps } from './types';

/** Keeps a draft until commit; a pending draft is committed when the panel closes. */
function useDraft<T>(value: T, commit: (next: T) => void) {
  const [draft, setDraft] = useState<T | null>(null);
  const pending = useRef<{ draft: T | null; commit: typeof commit }>({ draft, commit });
  pending.current = { draft, commit };
  useEffect(
    () => () => {
      const { draft: last, commit: save } = pending.current;
      if (last !== null) save(last);
    },
    []
  );
  return {
    shown: draft ?? value,
    setDraft,
    flush: () => {
      if (draft === null) return;
      setDraft(null);
      commit(draft);
    },
    // Escape also closes the panel, so drop the draft before the unmount commit reads it.
    cancel: () => {
      pending.current.draft = null;
      setDraft(null);
    },
  };
}

function TextField({ drawing, tool, chart, update }: DrawingEditorProps) {
  const { id } = drawing;
  const text = useDraft(drawing.text, next => {
    // The drawing may be gone when a pending draft commits on unmount.
    const current = chart.inspect().document.drawings.find(d => d.id === id);
    if (current && !current.locked && current.text !== next) update({ text: next });
  });
  const table = tool.type === 'table';

  return (
    <label className="flex flex-col gap-1.5">
      <span className={SECTION_HEADING}>Text</span>
      <textarea
        aria-label="Drawing text"
        maxLength={TEXT_LIMIT}
        rows={table ? 5 : 3}
        value={text.shown}
        disabled={drawing.locked}
        placeholder={table ? 'Symbol | Entry | Target' : 'Type your annotation…'}
        onChange={e => text.setDraft(e.target.value)}
        onBlur={text.flush}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            text.flush();
          } else if (e.key === 'Escape') {
            text.cancel();
          }
        }}
        className={cn(
          'min-h-16 resize-y border border-outline bg-background px-2 py-1.5 text-xs leading-4 text-rock outline-none placeholder:text-rock/30 focus:border-rock/40 disabled:opacity-50',
          table && 'font-mono'
        )}
      />
      <span className="text-[10px] leading-4 text-rock/40">
        {table
          ? 'One row per line. Split cells with tabs or |. ⌘/Ctrl + Enter to apply, Esc to discard.'
          : 'Enter for a new line. ⌘/Ctrl + Enter to apply, Esc to discard.'}
      </span>
    </label>
  );
}

function FontSizeField({ drawing, update }: Pick<DrawingEditorProps, 'drawing' | 'update'>) {
  const value = drawing.style.fontSize;
  const size = useDraft(String(value), draft => {
    const next = fontSizeFromDraft(draft);
    if (next !== null && next !== value) update({ style: { fontSize: next } });
  });

  return (
    <div className="flex min-h-7 items-center justify-between gap-3 text-xs text-rock/70">
      <span>Font size</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          aria-label="Font size"
          min={FONT_MIN}
          max={FONT_MAX}
          step={1}
          value={size.shown}
          onChange={e => size.setDraft(e.target.value)}
          onBlur={size.flush}
          onKeyDown={e => {
            if (e.key === 'Enter') size.flush();
            if (e.key === 'Escape') size.cancel();
          }}
          className="h-7 w-16 border border-outline bg-background px-2 text-right font-mono text-xs text-rock outline-none focus:border-rock/40"
        />
        <span className="text-rock/40">px</span>
      </span>
    </div>
  );
}

function DrawingTextEditorComponent(props: DrawingEditorProps) {
  const { drawing, tool, update } = props;
  const fields = textSettings(tool);

  return (
    <div className="flex flex-col gap-3">
      {/* Remount on a new drawing so a draft never lands on the wrong one. */}
      <TextField key={drawing.id} {...props} />
      <div className="flex flex-col gap-0.5">
        <FontSizeField key={drawing.id} drawing={drawing} update={update} />
        {fields.length > 0 && (
          <DrawingSettingFields fields={fields} drawing={drawing} update={update} flat />
        )}
      </div>
    </div>
  );
}

export const DrawingTextEditor = memo(DrawingTextEditorComponent);
