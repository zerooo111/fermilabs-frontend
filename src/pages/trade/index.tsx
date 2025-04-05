/**
 * Trade page
 * Main trading interface
 */
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAtom } from 'jotai';

import { MarketSelector } from '../../features/market-selector';
import { Orderbook } from '../../features/orderbook-view';
import { ChartContainer } from '../../features/chart';
import { TradePanel, MyOrders } from '../../features/order-placement';

import { useSequencerApi } from '../../shared/api/useSequencerApi';
import { orderbookAtom } from '../../entities/orderbook';
import { useMarkets, useSelectedMarket } from '../../entities/market';

function TradePage() {
  const navigate = useNavigate();
  const params = useParams();
  const { markets } = useMarkets();
  const { selectedMarket, setSelectedMarket } = useSelectedMarket();
  const [, setOrderbook] = useAtom(orderbookAtom);
  const lastUpdateTimeRef = useRef<number>(0);

  // Load markets and handle market selection
  useEffect(() => {
    const loadMarketsAndSetSelected = async () => {
      try {
        // Markets are already loaded via React Query in the useMarkets hook
        // We just need to handle the market selection based on URL

        // If we have a market ID in the URL
        if (params.id) {
          const marketId = params.id;
          const market = markets.find(m => m.uuid === marketId);

          if (market) {
            setSelectedMarket(market);
          } else if (markets.length > 0) {
            // Invalid market ID but we have markets, redirect to first market
            navigate(`/trade/${markets[0].uuid}`);
          } else {
            // Invalid market ID and no markets yet, redirect to /trade
            navigate('/trade');
          }
        } else if (markets.length > 0 && !selectedMarket) {
          // No market ID in URL, select first market as default
          setSelectedMarket(markets[0]);
        }
      } catch (error) {
        console.error('Error handling market selection:', error);
      }
    };

    loadMarketsAndSetSelected();
  }, [params.id, markets, setSelectedMarket, navigate, selectedMarket]);

  // Update URL when market is selected
  useEffect(() => {
    if (selectedMarket) {
      const currentPath = window.location.pathname;
      const newPath = `/trade/${selectedMarket.uuid}`;

      if (currentPath !== newPath) {
        navigate(newPath);
      }
    }
  }, [selectedMarket, navigate]);

  // Fetch orderbook data
  const { fetchOrderbook } = useSequencerApi();

  useQuery({
    queryKey: ['orderbook', selectedMarket?.uuid],
    queryFn: async ({ signal }) => {
      if (!selectedMarket) return null;

      const currentTime = Date.now();
      const fetchStartTime = currentTime;

      // Only proceed if this is a newer request
      if (fetchStartTime <= lastUpdateTimeRef.current) {
        return null;
      }

      try {
        // fetchOrderbook returns the orderbook data directly
        const orderbookData = await fetchOrderbook(selectedMarket.uuid);

        // Check if this response is still relevant
        if (fetchStartTime > lastUpdateTimeRef.current) {
          lastUpdateTimeRef.current = fetchStartTime;

          // Filter the orderbook data by market ID
          const filteredBuys = orderbookData.buys.filter(
            (it: any) => it.market_id === selectedMarket.uuid
          );
          const filteredSells = orderbookData.sells.filter(
            (it: any) => it.market_id === selectedMarket.uuid
          );

          // Only update if we have valid data
          if (signal?.aborted) {
            return null;
          }

          setOrderbook({
            buys: filteredBuys,
            sells: filteredSells,
            lastUpdated: new Date(),
          });
        }
        return orderbookData;
      } catch (error) {
        if (signal?.aborted) {
          return null;
        }
        throw error;
      }
    },
    refetchInterval: 10000,
    enabled: !!selectedMarket,
  });

  return (
    <div className="flex flex-col gap-1.5 px-3 min-h-[calc(100vh-60px)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <MarketSelector />
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
