/**
 * Perps page
 * Main perpetual contracts trading interface
 * Completely refactored to avoid circular dependencies
 */
import { useLayoutEffect, useEffect, useRef, memo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Orderbook } from '../../features/orderbook-view';
import { PerpsChartContainer } from '../../features/chart/ui/PerpsChartContainer';
import { PerpsTradePanel, PortfolioTabs } from '../../features/order-placement';
import { TradingSkeleton } from '@/shared/ui/TradingSkeleton';
import {
  useSelectedMarket,
  marketNameToSlug,
  findMarketBySlug,
  marketsAtom,
} from '@/entities/market';
import { useAtomValue } from 'jotai';
import { useSSEStream } from '@/shared/hooks/useSSEStream';
import { PauseCircle } from 'lucide-react';

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
  useSSEStream();
  const markets = useAtomValue(marketsAtom);
  const marketsRef = useRef(markets);
  marketsRef.current = markets;

  // Handle URL-based market selection - only on first render
  useLayoutEffect(() => {
    const loadAndSetMarketOnFirstRender = async (urlSlug: string | undefined) => {
      if (initialLoadRef.current) return;

      setIsLoadingMarkets(true);
      try {
        const markets = await loadMarkets();

        if (!markets?.length) {
          throw new Error('No markets found!');
        }

        // Resolve by slug first, then fall back to UUID for backwards compat
        const currentMarket = urlSlug
          ? findMarketBySlug(markets, urlSlug) || markets.find(m => m.uuid === urlSlug)
          : undefined;
        // Filter for perp markets only
        const perpMarkets = markets.filter(m => m.kind === 'perp');
        const firstPerpMarket = perpMarkets[0];

        if (!currentMarket && !firstPerpMarket) {
          throw new Error('No perp markets found!');
        }

        selectMarket(currentMarket?.uuid || firstPerpMarket?.uuid);
        initialLoadRef.current = true;
      } finally {
        setIsLoadingMarkets(false);
      }
    };

    loadAndSetMarketOnFirstRender(params.id);
  }, [loadMarkets, params.id, selectMarket]);

  // Update URL when selected market changes - but only after initial load
  useEffect(() => {
    if (selectedMarketId && initialLoadRef.current) {
      const markets = marketsRef.current;
      const market = markets.find(m => m.uuid === selectedMarketId);
      const slug = market ? marketNameToSlug(market.name) : selectedMarketId;
      navigate(`/perps/${slug}`, { replace: true });
    }
  }, [selectedMarketId, navigate]);

  // Show inline skeleton while markets are loading
  if (isLoadingMarkets) {
    return <TradingSkeleton />;
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)] overflow-hidden">
      <div className="mx-2 md:mx-4 mt-2 flex items-center justify-center gap-2 border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-center text-sm text-amber-300">
        <PauseCircle className="size-4 shrink-0" />
        <span>
          The exchange is temporarily paused while we migrate the program to a new version.
        </span>
      </div>

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
