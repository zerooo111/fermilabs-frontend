/** Button labels for each phase of an FLP transaction. */
import type { FlpPhase } from '../model/txStore';

export const PHASE_LABEL: Record<FlpPhase, string> = {
  idle: '',
  quoting: 'Preparing…',
  signing: 'Approve in wallet…',
  sending: 'Sending…',
  confirming: 'Confirming…',
};
