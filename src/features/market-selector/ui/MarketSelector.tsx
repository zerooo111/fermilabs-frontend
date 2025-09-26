/**
 * Market selector component
 * Allows users to select a market from a dropdown
 * Pure UI component that receives all data as props
 */
import { memo, useMemo, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Loader2 } from 'lucide-react';
import { marketsAtom, MarketKind } from '@/entities/market';
import { useAtomValue } from 'jotai';

interface MarketSelectorProps {
  selectedMarketId: string | null;
  onMarketSelect: (marketId: string) => void;
  isLoading: boolean;
  marketKind?: MarketKind; // Optional filter for market type
}

function MarketSelectorBase({
  selectedMarketId,
  onMarketSelect,
  isLoading,
  marketKind,
}: MarketSelectorProps) {
  const allMarkets = useAtomValue(marketsAtom);

  // Filter markets by kind if specified
  const markets = useMemo(() => {
    if (!marketKind) return allMarkets;
    return allMarkets.filter(market => market.kind === marketKind);
  }, [allMarkets, marketKind]);

  // Memoize the market items to prevent unnecessary recalculation
  const marketItems = useMemo(() => {
    if (markets.length === 0) {
      const marketTypeText = marketKind ? `${marketKind} ` : '';
      return (
        <SelectItem value="no-markets" disabled>
          No {marketTypeText}markets available
        </SelectItem>
      );
    }

    return markets.map(market => (
      <SelectItem key={market.uuid} value={market.uuid}>
        {market.name}
      </SelectItem>
    ));
  }, [markets, marketKind]);

  // Memoize the loading content
  const loadingContent = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    ),
    []
  );

  // Memoize the value change handler
  const handleValueChange = useCallback(
    (value: string) => {
      onMarketSelect(value);
    },
    [onMarketSelect]
  );

  return (
    <Select
      value={selectedMarketId || ''}
      onValueChange={handleValueChange}
      disabled={isLoading || markets.length === 0}
    >
      <SelectTrigger className="w-[180px] border-none !h-12">
        {isLoading ? (
          loadingContent
        ) : (
          <SelectValue className="!text-lg" placeholder="Select a market" />
        )}
      </SelectTrigger>
      <SelectContent className="-translate-x-[1px]">{marketItems}</SelectContent>
    </Select>
  );
}

// Export memoized version with explicit equality check
export const MarketSelector = memo(MarketSelectorBase, (prev, next) => {
  return (
    prev.selectedMarketId === next.selectedMarketId &&
    prev.isLoading === next.isLoading &&
    prev.onMarketSelect === next.onMarketSelect &&
    prev.marketKind === next.marketKind
  );
});
