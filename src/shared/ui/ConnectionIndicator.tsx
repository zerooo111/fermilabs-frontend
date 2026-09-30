import { useAtomValue } from 'jotai';
import { sseConnectionStateAtom } from '@/shared/api/sse-atoms';

const stateConfig = {
  connected: { color: 'bg-positive-solid', label: 'Connected' },
  connecting: { color: 'bg-warning-solid animate-pulse', label: 'Connecting' },
  reconnecting: { color: 'bg-warning-solid animate-pulse', label: 'Reconnecting' },
  disconnected: { color: 'bg-negative-solid', label: 'Disconnected' },
} as const;

export function ConnectionIndicator() {
  const state = useAtomValue(sseConnectionStateAtom);
  const { color, label } = stateConfig[state];

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`size-2 rounded-full ${color}`} />
      {state !== 'connected' && <span className="text-xs text-fg-tertiary">{label}</span>}
    </div>
  );
}
