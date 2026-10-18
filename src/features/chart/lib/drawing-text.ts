/**
 * Helpers for drawings' text, used by the Text settings tab. Limits mirror
 * CandleFrame's text editor and style validation.
 */
import type { DrawingSetting, DrawingToolDefinition } from 'candleframe/core';
import { countFromDraft } from './drawing-settings';

// CandleFrame rejects font sizes outside 10..32.
export const FONT_MIN = 10;
export const FONT_MAX = 32;

export const TEXT_LIMIT = 2000;

/** The tool's settings in the `Text` section. */
export function textSettings(tool: DrawingToolDefinition): DrawingSetting[] {
  return (tool.settings ?? []).filter(s => s.section === 'Text');
}

/** True for tools with editable text or `Text` settings. */
export function usesTextTab(tool: DrawingToolDefinition): boolean {
  return !!tool.editableText || textSettings(tool).length > 0;
}

/** A typed font size clamped to CandleFrame's limits, or null when blank or not a number. */
export function fontSizeFromDraft(draft: string): number | null {
  return countFromDraft(draft, FONT_MIN, FONT_MAX);
}
