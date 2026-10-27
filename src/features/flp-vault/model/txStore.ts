/**
 * Per-vault transaction state that outlives any one component: the phase of
 * the transaction in flight, the slot of the last confirmed one (data API
 * copies older than it don't show it yet), and what it did, for the success
 * step and the optimistic "pending" request. Closing the dialog mid-send
 * keeps all of it.
 */
import { useSyncExternalStore } from 'react';

export type FlpPhase = 'idle' | 'quoting' | 'signing' | 'sending' | 'confirming';

export interface LastTx {
  kind: string;
  amount: bigint;
  /** Simulated shares or USDC, for direct deposits and instant withdrawals. */
  expected: bigint | null;
  signature: string;
  slot: number;
  atMs: number;
}

export interface TxState {
  phase: FlpPhase;
  /** Kind of the action in flight, to label the right button. */
  active: string | null;
  /** Simulated outcome of the action in flight, once quoted. */
  quote: bigint | null;
  /** Data older than this slot predates the user's last transaction. */
  minSlot: number | null;
  last: LastTx | null;
}

const IDLE: TxState = { phase: 'idle', active: null, quote: null, minSlot: null, last: null };
const states = new Map<string, TxState>();
const listeners = new Set<() => void>();

export function getTxState(vault: string): TxState {
  return states.get(vault) ?? IDLE;
}

export function setTxState(vault: string, patch: Partial<TxState>) {
  states.set(vault, { ...getTxState(vault), ...patch });
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTxState(vault: string): TxState {
  return useSyncExternalStore(subscribe, () => getTxState(vault));
}
