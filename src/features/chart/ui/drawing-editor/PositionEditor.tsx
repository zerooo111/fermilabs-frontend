/**
 * Position tab for long / short position plans; the form is in position-form.tsx.
 */
import { POSITION_CLAIMS, isPositionType } from '@/features/chart/lib/position-metrics';
import { PositionForm } from './position-form';
import type { DrawingEditorSection } from './types';

export const positionSection: DrawingEditorSection = {
  id: 'position',
  label: 'Position',
  applies: tool => isPositionType(tool.type),
  claims: POSITION_CLAIMS,
  Component: PositionForm,
};
