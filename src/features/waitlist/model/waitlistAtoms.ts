import { atom } from 'jotai';

/** Open the global WaitlistDialog (mounted in AppProviders). */
export const waitlistOpenAtom = atom<boolean>(false);

/** Free-form source string passed with the next submission, e.g. "hero". */
export const waitlistSourceAtom = atom<string | null>(null);
