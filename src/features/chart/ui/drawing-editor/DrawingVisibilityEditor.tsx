/**
 * Visibility tab for every drawing: which interval families and counts it
 * shows on. The tab body lives in visibility-editor.tsx.
 */
import { DrawingVisibilityEditor } from './visibility-editor';
import type { DrawingEditorSection } from './types';

export const visibilitySection: DrawingEditorSection = {
  id: 'visibility',
  label: 'Visibility',
  applies: () => true,
  Component: DrawingVisibilityEditor,
};
