import { useAtom } from 'jotai';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { QUANTITY_THRESHOLD_OPTIONS, quantityThresholdAtom } from '../model/orderbook';

export function QuantityThresholdSelector() {
  const [threshold, setThreshold] = useAtom(quantityThresholdAtom);

  return (
    <Select
      value={threshold.toString()}
      onValueChange={value => setThreshold(Number(value) as typeof threshold)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Size resolution"
        className="!h-6 border-none bg-transparent px-2 text-[11px] text-rock/70 hover:text-rock"
      >
        <SelectValue placeholder="Resolution" />
      </SelectTrigger>
      <SelectContent>
        {QUANTITY_THRESHOLD_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value.toString()} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
