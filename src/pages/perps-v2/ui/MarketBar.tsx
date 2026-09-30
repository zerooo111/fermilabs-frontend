// Market selector and live stats, lifted out of the chart pane so they stay
// put above the dock whatever the user does with the panes.

import { useAtomValue } from 'jotai';

import { useSelectedMarket } from '@/entities/market';
import { chartLatestPriceAtom } from '@/features/chart/lib/latest-price';
import { ChartHeader } from '@/features/chart/ui/ChartHeader';
import { MarketCommand } from '@/features/market-selector';

export function MarketBar() {
  const { selectedMarket, selectMarket } = useSelectedMarket();
  const latestPrice = useAtomValue(chartLatestPriceAtom);

  return (
    <div className="pv2-marketbar">
      <ChartHeader
        selectedMarketId={selectedMarket?.uuid}
        onMarketSelect={selectMarket}
        latestPrice={latestPrice}
        selector={<MarketCommand />}
      />
    </div>
  );
}
