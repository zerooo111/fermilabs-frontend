/**
 * Trade page
 * Main trading interface
 * Completely refactored to avoid circular dependencies
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { MarketSelector } from '../../features/market-selector';
import { Orderbook } from '../../features/orderbook-view';
import { ChartContainer } from '../../features/chart';
import { TradePanel, MyOrders } from '../../features/order-placement';
import { useSelectedMarket } from '@/entities/market';

function TradePage() {
  const navigate = useNavigate();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const initialLoadRef = useRef(false);

  const { selectMarket, selectedMarketId, loadMarkets } = useSelectedMarket();

  // Handle URL-based market selection - only on first render
  useEffect(() => {
    const loadAndSetMarketOnFirstRender = async (urlMarketId: string | undefined) => {
      if (initialLoadRef.current) return; // Skip if not first load

      setIsLoading(true);
      // Load the markets
      const markets = await loadMarkets();

      if (!markets) {
        throw new Error('No market found!');
      }

      const currentMarket = markets.find(m => m.uuid === urlMarketId);

      if (!currentMarket) {
        // set the first market as default
        selectMarket(markets[0].uuid);
      } else {
        // We have a valid market
        selectMarket(currentMarket.uuid);
      }
      setIsLoading(false);
      initialLoadRef.current = true; // Mark initial load as complete
    };

    loadAndSetMarketOnFirstRender(params.id);
  }, [params, loadMarkets, selectMarket]);

  // Update URL when selected market changes - but only after initial load
  useEffect(() => {
    if (selectedMarketId && initialLoadRef.current) {
      navigate(`/trade/${selectedMarketId}`);
    }
  }, [selectedMarketId, navigate]);

  // Handle market selection from the UI
  const handleMarketSelect = (marketId: string) => {
    selectMarket(marketId);
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 min-h-[calc(100vh-60px)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <MarketSelector
            isLoading={isLoading}
            selectedMarketId={selectedMarketId}
            onMarketSelect={handleMarketSelect}
          />
        </div>
      </div>
      <div className="flex gap-1.5 rounded-lg">
        <div className="flex-1 border border-border rounded-lg overflow-hidden">
          <ChartContainer />
        </div>
        <Orderbook />
        <TradePanel />
      </div>
      <div className="flex-1 border border-border rounded-lg p-3">
        <MyOrders />
      </div>
    </div>
  );
}

export default TradePage;
