/**
 * Market entity model
 * Defines market-related state and operations
 */
import { atom, useAtom } from 'jotai';
import { useSequencerApi } from '../../shared/api/useSequencerApi';
import { useCallback } from 'react';

// Market types
export interface Market {
  uuid: string;
  name: string;
  base_mint: string;
  quote_mint: string;
  base_decimals: number;
  quote_decimals: number;
  base_lot_size: number;
  quote_lot_size: number;
  [key: string]: any;
}

// Market state atoms
export const marketsAtom = atom<Market[]>([]);
export const selectedMarketAtom = atom<Market | null>(null);

// Market hooks
export const useMarkets = () => {
  const [markets, setMarkets] = useAtom(marketsAtom);
  const { getMarkets } = useSequencerApi();

  const fetchMarkets = useCallback(async () => {
    const fetchedMarkets = await getMarkets();
    setMarkets(fetchedMarkets);
    return fetchedMarkets;
  }, [getMarkets, setMarkets]);

  return {
    markets,
    setMarkets,
    fetchMarkets,
  };
};

export const useSelectedMarket = () => {
  const [selectedMarket, setSelectedMarket] = useAtom(selectedMarketAtom);
  const { markets } = useMarkets();

  const selectMarketById = useCallback(
    (marketId: string) => {
      const market = markets.find(m => m.uuid === marketId);
      if (market) {
        setSelectedMarket(market);
      }
      return market;
    },
    [markets, setSelectedMarket]
  );

  return {
    selectedMarket,
    setSelectedMarket,
    selectMarketById,
  };
};

// Export market model
export const MarketModel = {
  useMarkets,
  useSelectedMarket,
};
