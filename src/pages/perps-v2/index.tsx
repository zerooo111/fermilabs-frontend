/**
 * Perps v2
 * Preview of the dockable trading terminal in the Forest & Dither look.
 * Same streams, markets and trading features as /perps.
 */
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAtomValue } from 'jotai';

import {
  findMarketBySlug,
  marketNameToSlug,
  marketsAtom,
  useSelectedMarket,
} from '@/entities/market';
import { useOrderbookStream } from '@/shared/hooks/useOrderbookStream';
import { useSSEStream } from '@/shared/hooks/useSSEStream';
import { TradingSkeleton } from '@/shared/ui/TradingSkeleton';

import { TerminalDock } from './ui/TerminalDock';

function PerpsV2Page() {
  const navigate = useNavigate();
  const params = useParams();
  const initialLoadRef = useRef(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);

  const { selectMarket, selectedMarketId, loadMarkets } = useSelectedMarket();
  useSSEStream();
  useOrderbookStream();
  const markets = useAtomValue(marketsAtom);
  const marketsRef = useRef(markets);
  marketsRef.current = markets;

  // Same market resolution as /perps: slug, then UUID, then first perp
  useLayoutEffect(() => {
    if (initialLoadRef.current) return;
    const load = async () => {
      setIsLoadingMarkets(true);
      try {
        const all = await loadMarkets();
        if (!all?.length) throw new Error('No markets found!');
        const fromUrl = params.id
          ? findMarketBySlug(all, params.id) || all.find(m => m.uuid === params.id)
          : undefined;
        const firstPerp = all.find(m => m.kind === 'perp');
        if (!fromUrl && !firstPerp) throw new Error('No perp markets found!');
        selectMarket(fromUrl?.uuid || firstPerp?.uuid);
        initialLoadRef.current = true;
      } finally {
        setIsLoadingMarkets(false);
      }
    };
    load();
  }, [loadMarkets, params.id, selectMarket]);

  useEffect(() => {
    if (!selectedMarketId || !initialLoadRef.current) return;
    const market = marketsRef.current.find(m => m.uuid === selectedMarketId);
    const slug = market ? marketNameToSlug(market.name) : selectedMarketId;
    navigate(`/perps-v2/${slug}`, { replace: true });
  }, [selectedMarketId, navigate]);

  if (isLoadingMarkets) return <TradingSkeleton />;

  // Header is h-14; the terminal owns the rest of the viewport
  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-[520px]">
      <TerminalDock />
    </div>
  );
}

export default memo(PerpsV2Page);
