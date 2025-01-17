import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { marketAccountAtom, marketAddressAtom } from '@/atoms/market';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { isValidSolanaAddress } from '@/utils/market';
import { config } from '@/solana/constants';

/**
 * Hook to manage market state and navigation
 * Handles market address from URL, market account deserialization,
 * and market switching functionality
 */
export function useMarket() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [client] = useAtom(fermiClientAtom);
  const [marketAccount, setMarketAccount] = useAtom(marketAccountAtom);
  const [marketAddress, setMarketAddress] = useAtom(marketAddressAtom);

  // Get market address from URL or use default
  useEffect(() => {
    const urlMarket = searchParams.get('market');

    if (!urlMarket) {
      // No market in URL, add default market
      setSearchParams({ market: config.devnet.defaultMarket });
      setMarketAddress(config.devnet.defaultMarket);
    } else if (isValidSolanaAddress(urlMarket)) {
      // Valid market address in URL
      setMarketAddress(urlMarket);
    } else {
      // Invalid market address, redirect to default
      navigate('/', { replace: true });
      setSearchParams({ market: config.devnet.defaultMarket });
      setMarketAddress(config.devnet.defaultMarket);
    }
  }, [searchParams, setSearchParams, navigate, setMarketAddress]);

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
        navigate('/', { replace: true });
        setSearchParams({ market: config.devnet.defaultMarket });
        setMarketAddress(config.devnet.defaultMarket);
      }
    };

    loadMarket();

    return () => {
      setMarketAccount(null);
    };
  }, [client, marketAddress, setMarketAccount, navigate, setSearchParams, setMarketAddress]);

  /**
   * Switch to a different market
   * @param newMarketAddress The address of the market to switch to
   */
  const switchMarket = (newMarketAddress: string) => {
    if (!isValidSolanaAddress(newMarketAddress)) {
      console.error('Invalid market address');
      return;
    }
    setSearchParams({ market: newMarketAddress });
  };

  return {
    marketAddress,
    marketAccount,
    isLoading: !marketAccount,
    error: !marketAddress || !isValidSolanaAddress(marketAddress),
    switchMarket,
  };
}
