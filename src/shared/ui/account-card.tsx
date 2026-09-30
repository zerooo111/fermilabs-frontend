import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount, useAccountMangoAccount } from '@/shared/hooks/useAccount';
import { Check, Copy, Loader2 } from 'lucide-react';

/** Sign color for PnL-like values. Zero stays neutral. */
function pnlTone(value: number) {
  if (value > 0) return 'text-positive-fg';
  if (value < 0) return 'text-negative-fg';
  return 'text-fg-secondary';
}

export function AccountCard() {
  const { publicKey } = useWallet();
  const { data: accountData, isLoading, error } = useAccount(publicKey?.toBase58() || '');
  const { pk: mangoAccount } = useAccountMangoAccount(publicKey?.toBase58());
  const [copied, setCopied] = useState(false);

  const handleCopyMango = async () => {
    if (!mangoAccount) return;
    await navigator.clipboard.writeText(mangoAccount);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value == null) return '0.00';
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  if (!publicKey) {
    return (
      <div className="text-center p-4 h-12 text-fg-secondary">
        Please connect your wallet to view account details
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-12 px-4 items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm text-fg-secondary">Loading account data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center h-12 px-4 text-negative-fg">Failed to load account data</div>
    );
  }

  if (!accountData) {
    return null;
  }

  const marginUsage = Math.max(accountData.margin_usage_fraction ?? 0, 0) * 100;

  return (
    <>
      <h3 className="text-base md:text-lg px-3 md:px-4 h-12 leading-12 bg-surface-raised border-b border-line-subtle font-medium text-fg-primary">
        Account
      </h3>

      {mangoAccount && (
        <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-line-subtle bg-surface-base">
          <span className="text-xs text-fg-tertiary">Fermi Account</span>
          <button
            onClick={handleCopyMango}
            className="flex items-center gap-1.5 text-xs font-mono text-fg-secondary hover:text-fg-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {`${mangoAccount.slice(0, 4)}...${mangoAccount.slice(-4)}`}
            {copied ? <Check className="size-3 text-positive-fg" /> : <Copy className="size-3" />}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 p-3 md:p-4">
        {/* USDC Collateral */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">USDC Collateral</span>
          <span className="text-sm font-mono">{formatCurrency(accountData.usdc_collateral)}</span>
        </div>

        {/* Account Equity */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Equity</span>
          <span className="text-sm font-mono">{formatCurrency(accountData.equity_snapshot)}</span>
        </div>

        {/* Free Collateral */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Free Collateral</span>
          <span className="text-sm font-mono">
            {formatCurrency(accountData.free_collateral_snapshot)}
          </span>
        </div>

        {/* Available for Withdrawal */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Available Withdrawal</span>
          <span className="text-sm font-mono">
            {formatCurrency(accountData.available_withdrawal_snapshot)}
          </span>
        </div>

        <div className="border-t border-line-subtle my-1" />

        {/* Initial Margin */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Initial Margin</span>
          <span className="text-sm font-mono">
            {formatCurrency(accountData.initial_margin_snapshot)}
          </span>
        </div>

        {/* Maintenance Margin */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Maintenance Margin</span>
          <span className="text-sm font-mono">
            {formatCurrency(accountData.maintenance_margin_snapshot)}
          </span>
        </div>

        {/* Margin Usage */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Margin Usage</span>
          <span className="text-sm font-mono">{marginUsage.toFixed(2)}%</span>
        </div>

        {/* Portfolio Leverage Limit */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Max Leverage</span>
          <span className="text-sm font-mono">
            {accountData.portfolio_leverage_limit_snapshot}x
          </span>
        </div>

        <div className="border-t border-line-subtle my-1" />

        {/* Unrealized PnL */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Unrealized PNL</span>
          <span className={`text-sm font-mono ${pnlTone(accountData.unrealized_pnl ?? 0)}`}>
            {formatCurrency(accountData.unrealized_pnl)}
          </span>
        </div>

        {/* Realized PnL */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Realized PNL</span>
          <span className={`text-sm font-mono ${pnlTone(accountData.realized_pnl_snapshot ?? 0)}`}>
            {formatCurrency(accountData.realized_pnl_snapshot)}
          </span>
        </div>

        {/* Realized PnL Total */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Total Realized PNL</span>
          <span className={`text-sm font-mono ${pnlTone(accountData.realized_pnl_total ?? 0)}`}>
            {formatCurrency(accountData.realized_pnl_total)}
          </span>
        </div>

        {/* Funding Accrued */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-fg-tertiary">Funding Accrued</span>
          <span
            className={`text-sm font-mono ${pnlTone(accountData.funding_accrued_snapshot ?? 0)}`}
          >
            {formatCurrency(accountData.funding_accrued_snapshot)}
          </span>
        </div>
      </div>
    </>
  );
}
