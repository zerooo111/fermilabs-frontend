/**
 * Jotai atoms for the API-keys feature.
 *
 * - `apiKeysDialogOpenAtom`: whether the ApiKeysPanel dialog is mounted/visible
 *   (mirrors `feeCreditDialogOpenAtom` so the header trigger can control it).
 *
 * The keys themselves are *not* held in a global atom — they're per-wallet,
 * session-scoped data fetched on demand by `useApiKeys`, so they live in that
 * hook's local state and re-fetch on wallet/visibility changes.
 */
import { atom } from 'jotai';

export const apiKeysDialogOpenAtom = atom(false);

/** Maximum active keys a wallet may hold (mirrors the backend 409 limit). */
export const MAX_ACTIVE_KEYS = 3;
