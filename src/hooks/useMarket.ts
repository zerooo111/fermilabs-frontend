import { useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { PublicKey } from '@solana/web3.js';
import { marketAccountAtom, marketAddressAtom } from '@/atoms/market';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { isValidSolanaAddress } from '@/utils/market';
import { config } from '@/solana/constants';

/**
 * Get market address from URL search params
 */
const getMarketFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('market');
};

/**
 * Update URL with new market address without page reload
 */
const updateUrlMarket = (marketAddress: string) => {
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set('market', marketAddress);
  window.history.pushState({}, '', newUrl);
};

/**
 * Hook to manage market state and navigation
 * Handles market address from URL, market account deserialization,
 * and market switching functionality
 */
export function useMarket() {
  const [client] = useAtom(fermiClientAtom);
  const [marketAccount, setMarketAccount] = useAtom(marketAccountAtom);
  const [marketAddress, setMarketAddress] = useAtom(marketAddressAtom);

  // Handle URL changes
  const handleUrlChange = useCallback(() => {
    const urlMarket = getMarketFromUrl();

    const targetMarket =
      urlMarket && isValidSolanaAddress(urlMarket) ? urlMarket : config.devnet.defaultMarketAddress;

    updateUrlMarket(targetMarket);
    setMarketAddress(targetMarket);
  }, [setMarketAddress]);

  // Listen for popstate (browser back/forward) events
  useEffect(() => {
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [handleUrlChange]);

  // Initial URL check
  useEffect(() => {
    handleUrlChange();
  }, [handleUrlChange]);

  // Deserialize market account when we have a valid market address
  useEffect(() => {
    if (!client || !marketAddress) return;

    const loadMarket = async () => {
      try {
        const account = await client.deserializeMarketAccount(new PublicKey(marketAddress));
        setMarketAccount(account);
      } catch (error) {
        console.error('Failed to load market:', error);
        setMarketAccount(null);
        // If market deserialization fails, redirect to default market
        updateUrlMarket(config.devnet.defaultMarketAddress);
        setMarketAddress(config.devnet.defaultMarketAddress);
      }
    };

    loadMarket();

    return () => {
      setMarketAccount(null);
    };
  }, [client, marketAddress, setMarketAccount, setMarketAddress]);

  /**
   * Switch to a different market
   * @param newMarketAddress The address of the market to switch to
   */
  const switchMarket = useCallback((newMarketAddress: string) => {
    if (!isValidSolanaAddress(newMarketAddress)) {
      console.error('Invalid market address');
      return;
    }
    updateUrlMarket(newMarketAddress);
  }, []);

  return {
    marketAddress,
    marketAccount,
    isLoading: !marketAccount,
    error: !marketAddress || !isValidSolanaAddress(marketAddress),
    switchMarket,
  };
}
