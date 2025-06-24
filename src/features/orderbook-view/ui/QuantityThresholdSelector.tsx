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
      <SelectTrigger className="!h-full w-32 border-none">
        <SelectValue placeholder="Min Size" />
      </SelectTrigger>
      <SelectContent>
        {QUANTITY_THRESHOLD_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value.toString()}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
