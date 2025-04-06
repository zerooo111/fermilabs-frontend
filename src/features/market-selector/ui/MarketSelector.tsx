/**
 * Market selector component
 * Allows users to select a market from a dropdown
 * Pure UI component that receives all data as props
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Loader2 } from 'lucide-react';
import { marketsAtom } from '@/entities/market';
import { useAtomValue } from 'jotai';

interface MarketSelectorProps {
  selectedMarketId: string | null;
  onMarketSelect: (marketId: string) => void;
  isLoading: boolean;
}

export function MarketSelector({
  selectedMarketId,
  onMarketSelect,
  isLoading,
}: MarketSelectorProps) {
  const markets = useAtomValue(marketsAtom);

  return (
    <Select
      value={selectedMarketId || ''}
      onValueChange={onMarketSelect}
      disabled={isLoading || markets.length === 0}
    >
      <SelectTrigger className="w-[180px]">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <SelectValue placeholder="Select a market" />
        )}
      </SelectTrigger>
      <SelectContent>
        {markets.length === 0 ? (
          <SelectItem value="no-markets" disabled>
            No markets available
          </SelectItem>
        ) : (
          markets.map(market => (
            <SelectItem key={market.uuid} value={market.uuid}>
              {market.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
