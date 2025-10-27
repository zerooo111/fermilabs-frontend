import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount } from '@/shared/hooks/useAccount';
import { Loader2 } from 'lucide-react';
import { getTokenDecimals } from '@/shared/lib/token-decimals';

export function AccountCard() {
  const { publicKey } = useWallet();
  const { data: accountData, isLoading, error } = useAccount(publicKey?.toBase58() || '');

  const formatCurrency = (value: number, tokenName?: string) => {
    const decimals = getTokenDecimals(tokenName);
    const formattedValue = value / Math.pow(10, decimals);
    return formattedValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  if (!publicKey) {
    return (
      <div className="text-center p-4 h-12 text-white/60">
        Please connect your wallet to view account details
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-12 px-4 items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm text-white/60">Loading account data...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-center h-12 px-4 text-white/60">Failed to load account data</div>;
  }

  if (!accountData) {
    return null;
  }

  // Calculate margin ratio
  const marginRatio =
    accountData.maintenance_margin_snapshot > 0
      ? (accountData.equity_snapshot / accountData.maintenance_margin_snapshot) * 100
      : 0;

  return (
    <>
      <h3 className="text-lg px-4 h-12 leading-12 bg-card border-b border-outline  font-medium">
        Account
      </h3>

      <div className="flex flex-col gap-2 p-4">
        {/* Account Margin Ratio */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Margin Ratio</span>
          <span className="text-sm font-mono">{marginRatio.toFixed(2)}%</span>
        </div>

        {/* Account Maintenance Margin */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Maintenance Margin</span>
          <span className="text-sm font-mono">
            {formatCurrency(accountData.maintenance_margin_snapshot, 'USDC')}
          </span>
        </div>

        {/* Account Equity */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Equity</span>
          <span className="text-sm font-mono">
            {formatCurrency(accountData.equity_snapshot, 'USDC')}
          </span>
        </div>

        {/* Unrealized PnL */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Unrealized PNL</span>
          <span
            className={`text-sm font-mono ${accountData.unrealized_pnl_snapshot >= 0 ? 'text-green-400' : 'text-red-400'}`}
          >
            {formatCurrency(accountData.unrealized_pnl_snapshot, 'USDC')}
          </span>
        </div>
      </div>
    </>
  );
}
