/**
 * Quick-order state: the palette's open/stage flags, the typed command, the
 * basket snapshot taken when the user moves on to the ticket, and the two
 * preferences worth remembering between sessions.
 */
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { QuickOrderLeg } from './parse';

/** 'palette' takes the command, 'ticket' reviews and sends it. */
export type QuickOrderStage = 'closed' | 'palette' | 'ticket';

export const quickOrderStageAtom = atom<QuickOrderStage>('closed');

export const quickOrderInputAtom = atom('');

/** The legs under review; frozen when the palette hands over to the ticket. */
export const quickOrderBasketAtom = atom<QuickOrderLeg[]>([]);

/** Worst fill accepted per leg, in basis points. 50 bps = 0.5%. */
export const quickOrderSlippageBpsAtom = atomWithStorage('quick-order:slippage-bps', 50);

/** Bases from the last baskets, newest first — shown as hints in the palette. */
export const quickOrderRecentBasesAtom = atomWithStorage<string[]>('quick-order:recent', []);
