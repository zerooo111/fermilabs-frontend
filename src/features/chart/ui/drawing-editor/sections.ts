/**
 * Settings panel tabs, in display order. Each section's file decides when it
 * applies; the panel shows the ones that do.
 */
import { positionSection } from './PositionEditor';
import { levelsSection } from './DrawingLevelsEditor';
import { optionsSection } from './DrawingOptionsForm';
import { textSection } from './DrawingTextEditor';
import { visibilitySection } from './DrawingVisibilityEditor';
import type { DrawingEditorSection } from './types';

export const DRAWING_EDITOR_SECTIONS: readonly DrawingEditorSection[] = [
  positionSection,
  textSection,
  optionsSection,
  levelsSection,
  visibilitySection,
];
