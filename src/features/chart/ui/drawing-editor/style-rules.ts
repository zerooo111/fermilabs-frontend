/**
 * When the Style tab shows and what it holds: the setting sections other tabs
 * claim, the settings left for it, and whether the label font size is its job.
 */
import type { Drawing, DrawingToolDefinition } from 'candleframe/core';
import { drawsLabels } from '@/features/chart/lib/drawing-settings';
import { levelsSection } from './DrawingLevelsEditor';
import { positionSection } from './PositionEditor';
import { textSection } from './DrawingTextEditor';

/** The tabs that take setting sections away from this one. */
const CLAIMING_SECTIONS = [positionSection, textSection, levelsSection];

export function claimedSections(tool: DrawingToolDefinition, drawing: Drawing) {
  return new Set(
    CLAIMING_SECTIONS.filter(s => s.applies(tool, drawing)).flatMap(s => s.claims ?? [])
  );
}

export function ownSettings(tool: DrawingToolDefinition, claimed: ReadonlySet<string>) {
  return (tool.settings ?? []).filter(s => !s.section || !claimed.has(s.section));
}

/** Font size shows here only when the Text tab, which owns it, doesn't. */
export const showsFontSize = (tool: DrawingToolDefinition, drawing: Drawing) =>
  drawsLabels(tool.type) && !textSection.applies(tool, drawing);
