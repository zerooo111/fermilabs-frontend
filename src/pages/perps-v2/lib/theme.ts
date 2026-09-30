// Terminal colour themes. The palettes live in themes.css; this owns the
// choice, applies it to <html> while the page is mounted and remembers it.

import { useLayoutEffect, useState } from 'react';

import { CHART_THEME_EVENT } from '@/shared/lib/chart-theme';

export type ThemeId = 'day' | 'night' | 'fermi';

export const THEMES: { id: ThemeId; label: string; scheme: 'light' | 'dark' }[] = [
  { id: 'day', label: 'Day', scheme: 'light' },
  { id: 'night', label: 'Night', scheme: 'dark' },
  { id: 'fermi', label: 'Fermi', scheme: 'dark' },
];

const STORAGE_KEY = 'fermi.perps-v2.theme';
const ATTRIBUTE = 'data-pv2-theme';

function readStored(): ThemeId {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (THEMES.some(t => t.id === value)) return value as ThemeId;
  } catch {
    // Storage blocked: fall through to the default
  }
  return 'fermi';
}

export function useTerminalTheme() {
  const [theme, setTheme] = useState<ThemeId>(readStored);

  // On <html>, not the page root, so portalled menus and the header follow
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute(ATTRIBUTE, theme);
    window.dispatchEvent(new Event(CHART_THEME_EVENT));
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    return () => root.removeAttribute(ATTRIBUTE);
  }, [theme]);

  return [theme, setTheme] as const;
}
