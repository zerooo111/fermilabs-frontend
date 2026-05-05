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
import { accountMetricsAtom } from '@/shared/api/sse-atoms';
import { OnboardingModal } from '@/features/onboarding/ui/OnboardingModal';
import { DepositModal } from '@/features/margin-panel/ui/DepositModal';

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
  const accountMetrics = useAtomValue(accountMetricsAtom);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  const walletKey = publicKey?.toBase58();
  const hasSession = !!(
    walletKey &&
    session[walletKey]?.token &&
    session[walletKey].expiresAt - 5 * 60 > Math.floor(Date.now() / 1000)
  );

  // Keep the gate open while there is no valid session.
  // Always close it when leaving the perps page so it doesn't follow the user.
  useEffect(() => {
    setGateOpen(!hasSession);
    return () => {
      setGateOpen(false);
    };
  }, [hasSession, setGateOpen]);

  // Show onboarding once per wallet when the account has no balance.
  // Wait for accountMetrics to arrive (SSE) before deciding — avoids a
  // false-positive flash on first load while data is still in flight.
  useEffect(() => {
    if (!publicKey || !hasSession || !accountMetrics) return;
    const key = `fermi_onboarding_v1_${publicKey.toBase58()}`;
    if (localStorage.getItem(key)) return;
    const isEmpty = accountMetrics.equity_snapshot === 0 && accountMetrics.usdc_collateral === 0;
    if (!isEmpty) return;
    // Small delay so the page finishes rendering before the modal appears.
    const timer = setTimeout(() => setOnboardingOpen(true), 800);
    return () => clearTimeout(timer);
  }, [publicKey, hasSession, accountMetrics]);

  const handleOnboardingDeposit = () => {
    setOnboardingOpen(false);
    setDepositOpen(true);
  };

  const handleOnboardingDismiss = () => {
    setOnboardingOpen(false);
    if (publicKey) {
      localStorage.setItem(`fermi_onboarding_v1_${publicKey.toBase58()}`, '1');
    }
  };

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
      <OnboardingModal
        open={onboardingOpen}
        onDeposit={handleOnboardingDeposit}
        onDismiss={handleOnboardingDismiss}
      />
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
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
