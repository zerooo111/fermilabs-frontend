import { useWallet } from '@solana/wallet-adapter-react';
import { usePNL } from '@/shared/hooks/usePNL';
import { Loader2 } from 'lucide-react';

export function AccountCard() {
  const { publicKey } = useWallet();
  const { data: pnlData, isLoading, error } = usePNL(publicKey?.toBase58() || '');

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (!publicKey) {
    return (
      <div className="text-center text-white/60">
        Please connect your wallet to view account details
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm text-white/60">Loading account data...</span>
      </div>
    );
  }

  if (error || !pnlData) {
    return (
      <div className="border border-outline rounded-lg bg-card">
        <div className="text-center text-white/60">Failed to load account data</div>
      </div>
    );
  }

  const { margin_metrics } = pnlData;

  return (
    <>
      <h3 className="text-lg px-4 h-12 leading-12 bg-card border-b border-outline  font-medium">
        Account
      </h3>

      <div className="flex flex-col gap-2 p-4">
        {/* Account Margin Ratio */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Margin Ratio</span>
          <span className="text-sm font-mono">0.00%</span>
        </div>

        {/* Account Maintenance Margin */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Maintenance Margin</span>
          <span className="text-sm font-mono">
            {formatCurrency(margin_metrics.maintenance_margin)}
          </span>
        </div>

        {/* Account Equity */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Equity</span>
          <span className="text-sm font-mono">{formatCurrency(margin_metrics.equity)}</span>
        </div>

        {/* Unrealized PnL */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Unrealized PNL</span>
          <span
            className={`text-sm font-mono ${parseFloat(margin_metrics.unrealized_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}
          >
            {formatCurrency(margin_metrics.unrealized_pnl)}
          </span>
        </div>
      </div>
    </>
  );
}
