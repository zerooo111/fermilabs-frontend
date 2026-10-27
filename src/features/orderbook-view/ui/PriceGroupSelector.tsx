import { useAtom } from 'jotai';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { PRICE_GROUP_OPTIONS, priceGroupAtom } from '../model/orderbook';

export function PriceGroupSelector() {
  const [priceGroup, setPriceGroup] = useAtom(priceGroupAtom);

  return (
    <Select
      value={priceGroup.toString()}
      onValueChange={value => setPriceGroup(Number(value) as typeof priceGroup)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Price grouping"
        className="!h-6 border-none bg-transparent px-2 text-[11px] text-rock/70 hover:text-rock"
      >
        <SelectValue placeholder="Grouping" />
      </SelectTrigger>
      <SelectContent>
        {PRICE_GROUP_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value.toString()} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
