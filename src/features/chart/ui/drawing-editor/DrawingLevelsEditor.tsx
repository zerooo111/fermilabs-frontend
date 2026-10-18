/**
 * Levels tab for Fibonacci and Gann drawings, the tools whose `Drawing.levels`
 * drive their geometry. The tab body lives in levels-editor.tsx.
 */
import { usesDrawingLevels } from '@/features/chart/lib/drawing-levels';
import { DrawingLevelsEditor } from './levels-editor';
import type { DrawingEditorSection } from './types';

export const levelsSection: DrawingEditorSection = {
  id: 'levels',
  label: 'Levels',
  applies: tool => usesDrawingLevels(tool.type),
  claims: ['Levels', 'Labels'],
  Component: DrawingLevelsEditor,
};
