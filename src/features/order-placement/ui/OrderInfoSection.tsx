import { ExternalLinkIcon, RefreshCw } from 'lucide-react';
import { baseMint, quoteMint, QUOTE_DECIMALS } from '@/shared/config/constants';
import { useSelectedMarket } from '@/entities/market';
import { useMarketTokenBalances } from '@/features/order-placement/lib/useMarketTokenBalances';
import { useWallet } from '@solana/wallet-adapter-react';

interface OrderAndBalanceInfoProps {
  orderValue: number;
}

export function OrderAndBalanceInfo({ orderValue }: OrderAndBalanceInfoProps) {
  const { selectedMarket } = useSelectedMarket();
  const { connected } = useWallet();
  const {
    balances,
    isLoading: balancesLoading,
    refetch: refetchBalances,
  } = useMarketTokenBalances();

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
            <div
              className="flex items-center justify-between text-white/50 font-light
            "
            >
              <span className="text-nowrap">{selectedMarket?.baseTokenName || 'BASE'}</span>
              <span className="tabular-nums">{balancesLoading ? '0' : balances.baseBalance}</span>
            </div>
            <div className="flex items-center justify-between text-white/50 font-light">
              <span className="text-nowrap">{selectedMarket?.quoteTokenName || 'QUOTE'}</span>
              <span className="tabular-nums">{balancesLoading ? '0' : balances.quoteBalance}</span>
            </div>
          </>
        )}
      </div>

      {/* Order Info Section */}
      <div className="flex items-center justify-between ">
        <span className="text-sm font-medium">Order Value</span>
        <span className="tabular-nums font-medium">{orderValue.toFixed(QUOTE_DECIMALS)}</span>
      </div>
      <div className="flex items-center justify-between text-white/50 font-light">
        <span>Fees</span>
        <span className="tabular-nums">0.01%</span>
      </div>
      <div className="flex items-center justify-between ">
        <span className="text-nowrap text-white/50 font-light">Base Token</span>
        <a
          href={`https://solscan.io/token/${selectedMarket?.base_mint || baseMint.toBase58()}`}
          className="group tabular-nums inline-flex items-center text-white/50  gap-1 font-normal  hover:text-blue-600 transition-colors"
          target="_blank"
          title={selectedMarket?.base_mint || baseMint.toBase58()}
        >
          {selectedMarket?.base_mint
            ? `${selectedMarket.base_mint.slice(0, 6)}...${selectedMarket.base_mint.slice(-6)}`
            : `${baseMint.toBase58().slice(0, 6)}...${baseMint.toBase58().slice(-6)}`}
          <ExternalLinkIcon className="size-0 group-hover:size-3 transition-all" />
        </a>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-nowrap text-white/50 font-light">Quote Token</span>
        <a
          href={`https://solscan.io/token/${selectedMarket?.quote_mint || quoteMint.toBase58()}`}
          className="group tabular-nums inline-flex items-center text-white/50 gap-1 font-normal  hover:text-blue-600 transition-colors"
          target="_blank"
          title={selectedMarket?.quote_mint || quoteMint.toBase58()}
        >
          {selectedMarket?.quote_mint
            ? `${selectedMarket.quote_mint.slice(0, 6)}...${quoteMint.toBase58().slice(-6)}`
            : `${quoteMint.toBase58().slice(0, 6)}...${quoteMint.toBase58().slice(-6)}`}
          <ExternalLinkIcon className="size-0 group-hover:size-3 transition-all" />
        </a>
      </div>
    </>
  );
}
