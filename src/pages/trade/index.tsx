/**
 * Trade page
 * Main trading interface
 * Completely refactored to avoid circular dependencies
 */
import { useLayoutEffect, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Orderbook } from '../../features/orderbook-view';
import { ChartContainer } from '../../features/chart';
import { TradePanel, MyOrders, MyTrades } from '../../features/order-placement';
import { useSelectedMarket } from '@/entities/market';

function TradePage() {
  const params = useParams();
  const { loadMarkets, selectMarket, selectedMarket } = useSelectedMarket();
  const navigate = useNavigate();
  const initialLoadRef = useRef(false);

  // Handle URL-based market selection - only on first render
  useLayoutEffect(() => {
    if (params.id) {
      loadMarkets();
      selectMarket(params.id);
    }
  }, [params.id, loadMarkets, selectMarket]);

  // Update URL when selected market changes - but only after initial load
  useEffect(() => {
    if (selectedMarket?.uuid && initialLoadRef.current) {
      navigate(`/trade/${selectedMarket.uuid}`, { replace: true });
    } else if (selectedMarket?.uuid) {
      initialLoadRef.current = true;
    }
  }, [selectedMarket?.uuid, navigate]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 grid grid-cols-[360px_1fr_360px] gap-4 p-4">
        <div className="flex flex-col gap-4">
          <Orderbook />
        </div>
        <div className="flex flex-col gap-4">
          <ChartContainer />
          <div className="flex-1">
            <MyTrades />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <TradePanel />
          <MyOrders />
        </div>
      </div>
    </div>
  );
}

export default TradePage;
