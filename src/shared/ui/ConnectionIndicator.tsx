import { useAtomValue } from 'jotai';
import { sseConnectionStateAtom } from '@/shared/api/sse-atoms';

const stateConfig = {
  connected: { color: 'bg-green-500', label: 'Connected' },
  connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Connecting' },
  reconnecting: { color: 'bg-yellow-500 animate-pulse', label: 'Reconnecting' },
  disconnected: { color: 'bg-red-500', label: 'Disconnected' },
} as const;

export function ConnectionIndicator() {
  const state = useAtomValue(sseConnectionStateAtom);
  const { color, label } = stateConfig[state];

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`size-2 rounded-full ${color}`} />
      {state !== 'connected' && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
