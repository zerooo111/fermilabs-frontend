import { useAtom } from 'jotai';
import { orderbookDepthModeAtom, type OrderbookDepthMode } from '@/entities/orderbook';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { DEPTH_MODE_OPTIONS } from '../model/orderbook';

export function DepthModeSelector() {
  const [depthMode, setDepthMode] = useAtom(orderbookDepthModeAtom);

  return (
    <Select value={depthMode} onValueChange={value => setDepthMode(value as OrderbookDepthMode)}>
      <SelectTrigger
        size="sm"
        aria-label="Depth view"
        className="!h-6 border-none bg-transparent px-2 text-[11px] text-rock/70 hover:text-rock"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DEPTH_MODE_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
