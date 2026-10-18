/**
 * Text tab for drawings with editable text or `Text` settings: the text, its
 * font size and those settings. The tab body lives in text-editor.tsx.
 */
import { usesTextTab } from '@/features/chart/lib/drawing-text';
import { DrawingTextEditor } from './text-editor';
import type { DrawingEditorSection } from './types';

export const textSection: DrawingEditorSection = {
  id: 'text',
  label: 'Text',
  applies: usesTextTab,
  claims: ['Text'],
  Component: DrawingTextEditor,
};
