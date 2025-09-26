import { ExternalLinkIcon, RefreshCw, Droplets } from 'lucide-react';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { useSelectedMarket } from '@/entities/market';
import { useMarketTokenBalances } from '@/features/order-placement/lib/useMarketTokenBalances';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useState } from 'react';
import { toast } from 'sonner';

interface OrderAndBalanceInfoProps {
  orderValue: number;
}

export function OrderAndBalanceInfo({ orderValue }: OrderAndBalanceInfoProps) {
  const { selectedMarket } = useSelectedMarket();
  const { connected, publicKey } = useWallet();
  const {
    balances,
    isLoading: balancesLoading,
    refetch: refetchBalances,
  } = useMarketTokenBalances();

  const { baseBalance, quoteBalance, baseMint, quoteMint } = balances;
  const { requestAirdrop } = useSequencerApi();
  const [isRequestingAirdrop, setIsRequestingAirdrop] = useState<string | null>(null);

  const handleAirdrop = async (mintAddress: string) => {
    if (!publicKey || !connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsRequestingAirdrop(mintAddress);
    try {
      await requestAirdrop(publicKey.toString(), mintAddress);
      toast.success(`Airdrop requested for ${mintAddress.slice(0, 6)}...${mintAddress.slice(-6)}`);
      // Refetch balances after a short delay to show updated balance
      setTimeout(() => refetchBalances(), 2000);
    } catch (error) {
      toast.error(
        `Failed to request airdrop: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsRequestingAirdrop(null);
    }
  };

  return (
    <>
      {/* Wallet Balances Section */}
      <div className="mb-2 pb-2 border-b border-outline">
        <div className="flex items-center justify-between mb-1">
          <span className="text-nowrap text-sm font-medium">Your Balances</span>
          <button
            onClick={() => refetchBalances()}
            className="text-blue-600 hover:text-blue-800 transition-colors"
            title="Refresh balances"
            disabled={!connected}
          >
            <RefreshCw className={`size-3 ${balancesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {!connected ? (
          <div className="text-xs text-gray-500 italic">Connect wallet to view balances</div>
        ) : (
          <>
            <div className="flex items-center justify-between text-white/50 font-light">
              <div className="flex items-center gap-1">
                <span className="text-nowrap">{selectedMarket?.baseTokenName || 'BASE'}</span>
                <button
                  onClick={() => handleAirdrop(baseMint || selectedMarket?.base_mint || '')}
                  disabled={isRequestingAirdrop !== null}
                  className="cursor-pointer text-blue-500 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Request ${selectedMarket?.baseTokenName || 'BASE'} airdrop`}
                >
                  <Droplets
                    className={`size-3 ${isRequestingAirdrop === (baseMint || selectedMarket?.base_mint || '') ? 'animate-pulse' : ''}`}
                  />
                </button>
              </div>
              <span className="tabular-nums">{balancesLoading ? '0' : baseBalance}</span>
            </div>
            <div className="flex items-center justify-between text-white/50 font-light">
              <div className="flex items-center gap-1">
                <span className="text-nowrap">{selectedMarket?.quoteTokenName || 'QUOTE'}</span>
                <button
                  onClick={() => handleAirdrop(quoteMint || selectedMarket?.quote_mint || '')}
                  disabled={isRequestingAirdrop !== null}
                  className="cursor-pointer text-blue-500 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Request ${selectedMarket?.quoteTokenName || 'QUOTE'} airdrop`}
                >
                  <Droplets
                    className={`size-3 ${isRequestingAirdrop === (quoteMint || selectedMarket?.quote_mint || '') ? 'animate-pulse' : ''}`}
                  />
                </button>
              </div>
              <span className="tabular-nums">{balancesLoading ? '0' : quoteBalance}</span>
            </div>
          </>
        )}
      </div>

      {/* Order Info Section */}
      <div className="flex items-center justify-between ">
        <span className="text-sm font-medium">Order Value</span>
        <button className="tabular-nums font-medium">
          {orderValue.toFixed(getTokenDecimals(selectedMarket?.quoteTokenName))}
        </button>
      </div>
      <div className="flex items-center justify-between text-white/50 font-light">
        <span>Fees</span>
        <span className="tabular-nums">0.01%</span>
      </div>
      <div className="flex items-center justify-between ">
        <span className="text-nowrap text-white/50 font-light">Base Token</span>
        <a
          href={`https://solscan.io/token/${baseMint || selectedMarket?.base_mint || ''}`}
          className="group tabular-nums inline-flex items-center text-white/50  gap-1 font-normal  hover:text-blue-600 transition-colors"
          target="_blank"
          title={baseMint || selectedMarket?.base_mint || ''}
        >
          {baseMint || selectedMarket?.base_mint
            ? `${(baseMint || selectedMarket?.base_mint || '').slice(0, 6)}...${(baseMint || selectedMarket?.base_mint || '').slice(-6)}`
            : ''}
          <ExternalLinkIcon className="size-0 group-hover:size-3 transition-all" />
        </a>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-nowrap text-white/50 font-light">Quote Token</span>
        <a
          href={`https://solscan.io/token/${quoteMint || selectedMarket?.quote_mint || ''}`}
          className="group tabular-nums inline-flex items-center text-white/50 gap-1 font-normal  hover:text-blue-600 transition-colors"
          target="_blank"
          title={quoteMint || selectedMarket?.quote_mint || ''}
        >
          {quoteMint || selectedMarket?.quote_mint
            ? `${(quoteMint || selectedMarket?.quote_mint || '').slice(0, 6)}...${(quoteMint || selectedMarket?.quote_mint || '').slice(-6)}`
            : ''}
          <ExternalLinkIcon className="size-0 group-hover:size-3 transition-all" />
        </a>
      </div>
    </>
  );
}
