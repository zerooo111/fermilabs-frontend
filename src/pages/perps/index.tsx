/**
 * Perps page
 * Main perpetual contracts trading interface
 * Completely refactored to avoid circular dependencies
 */
import { useLayoutEffect, useEffect, useRef, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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

  const { selectMarket, selectedMarketId, loadMarkets } = useSelectedMarket();

  // Handle URL-based market selection - only on first render
  useLayoutEffect(() => {
    const loadAndSetMarketOnFirstRender = async (urlMarketId: string | undefined) => {
      if (initialLoadRef.current) return;

      try {
        const markets = await loadMarkets();

        if (!markets?.length) {
          throw new Error('No markets found!');
        }

        const currentMarket = markets.find(m => m.uuid === urlMarketId);
        // Batch these operations
        Promise.resolve().then(() => {
          selectMarket(currentMarket?.uuid || markets[0].uuid);
          initialLoadRef.current = true;
        });
      } catch {
        // Silent error handling
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)] border-outline">
      <div className="flex mx-4 divide-x divide-outline border-x border-outline">
        <div className="flex-1">
          <MemoizedPerpsChartContainer />
        </div>
        <MemoizedOrderbook />
        <MemoizedPerpsTradePanel />
      </div>
      <div className="flex-1 flex flex-col  border-t border-outline">
        <MemoizedPortfolioTabs />
      </div>
    </div>
  );
}

// Memoize the entire page component if it's wrapped in any providers
export default memo(PerpsPage);
