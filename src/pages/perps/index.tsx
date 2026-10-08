/**
 * Perps page
 * Main perpetual contracts trading interface
 * Completely refactored to avoid circular dependencies
 */
import { useLayoutEffect, useEffect, useRef, memo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Orderbook } from '../../features/orderbook-view';
import { PerpsChartContainer } from '../../features/chart/ui/PerpsChartContainer';
import { TradeTicket, PortfolioTabs } from '../../features/order-placement';
import { TradingSkeleton } from '@/shared/ui/TradingSkeleton';
import { AccountCard } from '@/shared/ui/account-card';
import {
  useSelectedMarket,
  marketNameToSlug,
  findMarketBySlug,
  marketsAtom,
} from '@/entities/market';
import { useAtomValue } from 'jotai';
import { useSSEStream } from '@/shared/hooks/useSSEStream';
import { useOrderbookStream } from '@/shared/hooks/useOrderbookStream';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { TerminalDock, useClassicLayoutAtom } from '@/features/layout';

// Memoize static components that don't depend on frequently changing props
const MemoizedOrderbook = memo(Orderbook);
const MemoizedPerpsChartContainer = memo(PerpsChartContainer);
const MemoizedTradeTicket = memo(TradeTicket);
const MemoizedPortfolioTabs = memo(PortfolioTabs);

function PerpsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const initialLoadRef = useRef(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);

  const { selectMarket, selectedMarketId, loadMarkets } = useSelectedMarket();
  useSSEStream();
  useOrderbookStream();
  const markets = useAtomValue(marketsAtom);
  // Dockable layout is desktop-only; phones keep the stacked flow below.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const useClassicLayout = useAtomValue(useClassicLayoutAtom);
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

  if (isDesktop && !useClassicLayout) {
    return (
      <div className="mx-4 h-[calc(100vh-60px)] border-x border-outline overflow-hidden">
        <TerminalDock />
      </div>
    );
  }

  // Mobile stacks chart, orderbook, ticket, portfolio. On desktop (classic
  // layout) the ticket is its own full-height column, so the chart row keeps a
  // fixed height instead of stretching to the ticket.
  return (
    <div className="mx-2 md:mx-4 flex flex-col min-h-[calc(100vh-60px)] border-x border-outline overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[520px_1fr]">
      {/* Chart + orderbook */}
      <div className="flex flex-col lg:flex-row min-w-0 divide-y lg:divide-y-0 lg:divide-x divide-outline lg:col-start-1 lg:row-start-1">
        <div className="flex-1 min-w-0 overflow-hidden">
          <MemoizedPerpsChartContainer />
        </div>
        <div className="overflow-hidden">
          <MemoizedOrderbook />
        </div>
      </div>

      {/* Trade ticket and account details - spans both rows on desktop */}
      <div className="flex flex-col divide-y divide-outline border-t border-outline lg:border-t-0 lg:border-l overflow-hidden lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <MemoizedTradeTicket />
        <div className="empty:hidden lg:w-xs">
          <AccountCard />
        </div>
      </div>

      {/* Portfolio */}
      <div className="flex-1 flex flex-col border-t border-outline overflow-hidden lg:col-start-1 lg:row-start-2">
        <MemoizedPortfolioTabs />
      </div>
    </div>
  );
}

// Memoize the entire page component if it's wrapped in any providers
export default memo(PerpsPage);
