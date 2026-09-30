/**
 * ToastProvider.tsx
 * Global toast notification provider using Sonner
 */

import type { CSSProperties } from 'react';
import { Toaster } from 'sonner';

/**
 * Sonner reads its palette from these CSS variables. richColors switches to
 * the per-type set, so success and error toasts keep their status tint.
 */
const TOAST_COLORS = {
  fontFamily: 'var(--font-mono)',
  '--normal-bg': 'var(--color-surface-overlay)',
  '--normal-border': 'var(--color-line)',
  '--normal-text': 'var(--color-fg-primary)',
  '--success-bg': 'var(--color-positive-muted)',
  '--success-border': 'var(--color-positive-line)',
  '--success-text': 'var(--color-positive-fg)',
  '--error-bg': 'var(--color-negative-muted)',
  '--error-border': 'var(--color-negative-line)',
  '--error-text': 'var(--color-negative-fg)',
  '--warning-bg': 'var(--color-warning-muted)',
  '--warning-border': 'var(--color-warning-line)',
  '--warning-text': 'var(--color-warning-fg)',
  '--info-bg': 'var(--color-info-muted)',
  '--info-border': 'var(--color-info-line)',
  '--info-text': 'var(--color-info-fg)',
} as CSSProperties;

export function ToastProvider() {
  return (
    <Toaster
      richColors
      position="bottom-center"
      theme="dark"
      style={TOAST_COLORS}
      toastOptions={{ className: '!rounded-none' }}
    />
  );
}
