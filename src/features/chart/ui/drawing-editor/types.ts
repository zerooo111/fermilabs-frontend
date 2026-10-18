/**
 * Contract between the drawing toolbar / settings panel and the sections
 * they host. Every section gets the selected drawing, its tool definition and
 * an `update` that commits one undoable `drawing.update`.
 */
import type { ComponentType } from 'react';
import type { ChartApi } from 'candleframe/chart';
import type { Drawing, DrawingPatch, DrawingToolDefinition } from 'candleframe/core';

export interface DrawingEditorProps {
  chart: ChartApi;
  /** Fresh copy from the chart document; changes after every update. */
  drawing: Drawing;
  tool: DrawingToolDefinition;
  /** One undo step per call: call on commit (change / blur), not per keystroke. */
  update: (patch: DrawingPatch) => void;
  /** Price decimals of the pane's market, for price fields. */
  pricePrecision: number;
  /** Setting sections other tabs show for this drawing; leave them out. */
  claimed: ReadonlySet<string>;
}

/** A tab in the drawing settings panel. */
export interface DrawingEditorSection {
  id: string;
  label: string;
  /** Whether this tab shows for the selected drawing. */
  applies: (tool: DrawingToolDefinition, drawing: Drawing) => boolean;
  /** `DrawingSetting.section`s this tab renders, so the Style tab skips them. */
  claims?: readonly string[];
  Component: ComponentType<DrawingEditorProps>;
}
