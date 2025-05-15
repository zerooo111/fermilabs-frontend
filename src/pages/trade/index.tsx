/**
 * Trade page
 * Main trading interface
 * Completely refactored to avoid circular dependencies
 */
import { useLayoutEffect, useEffect, useRef, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Orderbook } from '../../features/orderbook-view';
import { ChartContainer } from '../../features/chart';
import { TradePanel, OrdersAndTradesTab } from '../../features/order-placement';
import { useSelectedMarket } from '@/entities/market';

// Memoize static components that don't depend on frequently changing props
const MemoizedOrderbook = memo(Orderbook);
const MemoizedChartContainer = memo(ChartContainer);
const MemoizedTradePanel = memo(TradePanel);
const MemoizedOrdersAndTradesTab = memo(OrdersAndTradesTab);

function TradePage() {
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
      } catch (error) {
        console.error('Failed to load markets:', error);
      }
    };

    loadAndSetMarketOnFirstRender(params.id);
  }, []); // Empty deps since we only want this on mount

  // Update URL when selected market changes - but only after initial load
  useEffect(() => {
    if (selectedMarketId && initialLoadRef.current) {
      navigate(`/trade/${selectedMarketId}`, { replace: true }); // Use replace to avoid browser history buildup
    }
  }, [selectedMarketId, navigate]);

  return (
    <div className="flex flex-col gap-1.5 px-3 min-h-[calc(100vh-60px)]">
      <div className="flex gap-1.5 rounded-lg">
        <div className="flex-1 rounded-lg">
          <MemoizedChartContainer />
        </div>
        <MemoizedOrderbook />
        <MemoizedTradePanel />
      </div>
      <div className="flex-1 rounded-lg p-3 glass-panel">
        <MemoizedOrdersAndTradesTab />
      </div>
    </div>
  );
}

// Memoize the entire page component if it's wrapped in any providers
export default memo(TradePage);
