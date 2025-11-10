/**
 * Perps page
 * Main perpetual contracts trading interface
 * Completely refactored to avoid circular dependencies
 */
import { useLayoutEffect, useEffect, useRef, memo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { Orderbook } from '../../features/orderbook-view';
import { PerpsChartContainer } from '../../features/chart/ui/PerpsChartContainer';
import { PerpsTradePanel, PortfolioTabs } from '../../features/order-placement';
import { useSelectedMarket } from '@/entities/market';

// Memoize static components that don't depend on frequently changing props
const MemoizedOrderbook = memo(Orderbook);
const MemoizedPerpsChartContainer = memo(PerpsChartContainer);
const MemoizedPerpsTradePanel = memo(PerpsTradePanel);
const MemoizedPortfolioTabs = memo(PortfolioTabs);

function PerpsPage() {
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
        // Filter for perp markets only
        const perpMarkets = markets.filter(m => m.kind === 'perp');
        const firstPerpMarket = perpMarkets[0];

        if (!currentMarket && !firstPerpMarket) {
          throw new Error('No perp markets found!');
        }

        // Batch these operations
        Promise.resolve().then(() => {
          selectMarket(currentMarket?.uuid || firstPerpMarket?.uuid);
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
      navigate(`/perps/${selectedMarketId}`, { replace: true }); // Use replace to avoid browser history buildup
    }
  }, [selectedMarketId, navigate]);

  // Show fullscreen loading while markets are loading
  if (isLoadingMarkets) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading ..</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)] overflow-hidden">
      {/* Main trading area - responsive layout */}
      <div className="flex flex-col lg:flex-row mx-2 md:mx-4 border-x border-outline divide-y lg:divide-y-0 lg:divide-x divide-outline">
        {/* Chart section - full width on mobile, flex-1 on desktop */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <MemoizedPerpsChartContainer />
        </div>

        {/* Orderbook - stacks below chart on mobile, side panel on desktop */}
        <div className="overflow-hidden">
          <MemoizedOrderbook />
        </div>

        {/* Trade Panel - stacks below orderbook on mobile, side panel on desktop */}
        <div className="overflow-hidden">
          <MemoizedPerpsTradePanel />
        </div>
      </div>

      {/* Portfolio section - always full width at bottom */}
      <div className="flex-1 flex flex-col border-t border-outline overflow-hidden">
        <MemoizedPortfolioTabs />
      </div>
    </div>
  );
}

// Memoize the entire page component if it's wrapped in any providers
export default memo(PerpsPage);
