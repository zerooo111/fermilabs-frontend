/**
 * Style tab of the drawing settings panel. It shows when the tool has settings
 * no other tab claims, or paints fills or labels no other tab styles.
 */
import { drawsFill } from '@/features/chart/lib/drawing-settings';
import { StyleForm } from './style-form';
import { claimedSections, ownSettings, showsFontSize } from './style-rules';
import type { DrawingEditorSection } from './types';

export const optionsSection: DrawingEditorSection = {
  id: 'style',
  label: 'Style',
  applies: (tool, drawing) =>
    ownSettings(tool, claimedSections(tool, drawing)).length > 0 ||
    drawsFill(tool.type) ||
    showsFontSize(tool, drawing),
  Component: StyleForm,
};
