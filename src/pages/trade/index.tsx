/**
 * Trade page
 * Main trading interface
 * Completely refactored to avoid circular dependencies
 */
import { useLayoutEffect, useEffect, useRef, memo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { Orderbook } from '../../features/orderbook-view';
import { ChartContainer } from '../../features/chart';
import { SpotTradePanel, PortfolioTabs } from '../../features/order-placement';
import { useSelectedMarket } from '@/entities/market';

// Memoize static components that don't depend on frequently changing props
const MemoizedOrderbook = memo(Orderbook);
const MemoizedChartContainer = memo(ChartContainer);
const MemoizedSpotTradePanel = memo(SpotTradePanel);
const MemoizedPortfolioTabs = memo(PortfolioTabs);

function TradePage() {
  const navigate = useNavigate();
  const params = useParams();
  const initialLoadRef = useRef(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);

  const { selectMarket, selectedMarketId, loadMarkets } = useSelectedMarket();

  // Handle URL-based market selection - only on first render
  useLayoutEffect(() => {
    const loadAndSetMarketOnFirstRender = async (urlMarketId: string | undefined) => {
      if (initialLoadRef.current) return;

      setIsLoadingMarkets(true);
      try {
        const markets = await loadMarkets();

        if (!markets?.length) {
          throw new Error('No markets found!');
        }

        const currentMarket = markets.find(m => m.uuid === urlMarketId);
        // Filter for spot markets only
        const spotMarkets = markets.filter(m => m.kind === 'spot');
        const firstSpotMarket = spotMarkets[0];

        if (!currentMarket && !firstSpotMarket) {
          throw new Error('No spot markets found!');
        }

        // Batch these operations
        Promise.resolve().then(() => {
          selectMarket(currentMarket?.uuid || firstSpotMarket?.uuid);
          initialLoadRef.current = true;
          setIsLoadingMarkets(false);
        });
      } catch {
        // Silent error handling
        setIsLoadingMarkets(false);
      }
    };

    loadAndSetMarketOnFirstRender(params.id);
  }, [loadMarkets, params.id, selectMarket]); // Empty deps since we only want this on mount

  // Update URL when selected market changes - but only after initial load
  useEffect(() => {
    if (selectedMarketId && initialLoadRef.current) {
      navigate(`/spot/${selectedMarketId}`, { replace: true }); // Use replace to avoid browser history buildup
    }
  }, [selectedMarketId, navigate]);

  // Show fullscreen loading while markets are loading
  if (isLoadingMarkets) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading markets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)] border-outline">
      <div className="flex mx-4 divide-x divide-outline border-x border-outline">
        <div className="flex-1">
          <MemoizedChartContainer />
        </div>
        <MemoizedOrderbook />
        <MemoizedSpotTradePanel />
      </div>
      <div className="flex-1 flex flex-col  border-t border-outline">
        <MemoizedPortfolioTabs />
      </div>
    </div>
  );
}

// Memoize the entire page component if it's wrapped in any providers
export default memo(TradePage);
