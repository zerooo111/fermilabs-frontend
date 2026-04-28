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
import { useAtomValue, useSetAtom } from 'jotai';
import { useSSEStream } from '@/shared/hooks/useSSEStream';
import { useWallet } from '@solana/wallet-adapter-react';
import { gateOpenAtom, accessSessionAtom } from '@/features/access-gate';

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

  const { publicKey } = useWallet();
  const setGateOpen = useSetAtom(gateOpenAtom);
  const session = useAtomValue(accessSessionAtom);

  const walletKey = publicKey?.toBase58();
  const hasSession = !!(
    walletKey &&
    session[walletKey]?.token &&
    session[walletKey].expiresAt - 5 * 60 > Math.floor(Date.now() / 1000)
  );

  // Keep the gate open while there is no valid session
  useEffect(() => {
    setGateOpen(!hasSession);
  }, [hasSession, setGateOpen]);

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

  // Hard gate: do not render trading UI without a valid session.
  // The InviteCodeModal is rendered globally (via gateOpenAtom) on top of this.
  if (!hasSession) {
    return <div className="min-h-[calc(100vh-60px)]" aria-hidden />;
  }

  // Show inline skeleton while markets are loading
  if (isLoadingMarkets) {
    return <TradingSkeleton />;
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
