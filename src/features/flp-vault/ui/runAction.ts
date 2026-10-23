/** Shared submit handling for FLP transactions: phase labels and toasts. */
import { toast } from 'sonner';

import { flpExplorerTxUrl } from '../model/config';
import { describeFlpError } from '../model/format';
import {
  FlpConfirmationTimeout,
  type FlpActionInput,
  type FlpPhase,
  type useFlpActions,
} from '../model/useFlpActions';

export const PHASE_LABEL: Record<FlpPhase, string> = {
  idle: '',
  quoting: 'Preparing…',
  signing: 'Approve in wallet…',
  sending: 'Sending…',
  confirming: 'Confirming…',
};

type Tx = ReturnType<typeof useFlpActions>;

/** Run an action with the standard toasts; `message` names what succeeded. */
export function runAction(
  tx: Tx,
  input: FlpActionInput,
  message: (expected: bigint | null) => string,
  onDone?: () => void
) {
  tx.mutate(input, {
    onSuccess: ({ signature, expected }) => {
      onDone?.();
      toast.success(message(expected), {
        action: { label: 'View', onClick: () => window.open(flpExplorerTxUrl(signature)) },
      });
    },
    onError: err => {
      const sig = err instanceof FlpConfirmationTimeout ? err.signature : null;
      toast.error(describeFlpError(err), {
        action: sig
          ? { label: 'View', onClick: () => window.open(flpExplorerTxUrl(sig)) }
          : undefined,
      });
    },
  });
}
