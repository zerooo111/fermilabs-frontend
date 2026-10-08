import { atom } from 'jotai';
import type { DockviewApi } from 'dockview-react';

/** The live dock instance, so chrome outside the dock (the app header) can drive it. Null when no dock is mounted. */
export const dockApiAtom = atom<DockviewApi | null>(null);
