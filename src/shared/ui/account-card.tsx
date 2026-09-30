import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount, useAccountMangoAccount } from '@/shared/hooks/useAccount';
import { Check, Copy, Loader2 } from 'lucide-react';
import { HealthBar } from '@/shared/ui/health-bar';
import { accountHealthPct, healthTone } from '@/shared/lib/account-health';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';

const formatCurrency = (value: number | undefined | null) => {
  if (value == null) return '0.00';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
};

const pnlClass = (value: number | undefined | null) =>
  (value ?? 0) >= 0 ? 'text-success' : 'text-danger';

function Row({
  label,
  children,
  className = 'text-rock',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-rock/50">{label}</span>
      <span className={`font-mono tabular-nums ${className}`}>{children}</span>
    </div>
  );
}

/**
 * Account summary under the trade ticket: health plus the few numbers worth
 * watching while trading. Everything else lives in the Details modal.
 */
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

  // Sits under the trade ticket, whose Connect wallet button covers this case
  if (!publicKey) return null;

  if (isLoading) {
    return (
      <div className="flex h-12 px-3 items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-xs text-rock/60">Loading account data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center h-12 px-3 text-xs text-rock/60">Failed to load account data</div>
    );
  }

  if (!accountData) {
    return null;
  }

  const marginUsage = Math.max(accountData.margin_usage_fraction ?? 0, 0) * 100;
  const equity = accountData.equity_snapshot;
  const health = accountHealthPct(equity - accountData.maintenance_margin_snapshot, equity);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help text-sm font-medium underline decoration-rock/30 decoration-dotted underline-offset-4">
              Account Health
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            How far the account is from liquidation. 100% means no open risk; at 0% positions can be
            liquidated.
          </TooltipContent>
        </Tooltip>
        <span
          className={`text-sm font-mono ${health === null ? 'text-rock/60' : healthTone(health).text}`}
        >
          {health === null ? '—' : `${health.toFixed(0)}%`}
        </span>
      </div>
      <HealthBar value={health} />

      <div className="flex flex-col gap-1.5">
        <Row label="Account value">{formatCurrency(equity)}</Row>
        <Row label="Maintenance margin">
          {formatCurrency(accountData.maintenance_margin_snapshot)}
        </Row>
        <Row label="Unrealized PnL" className={pnlClass(accountData.unrealized_pnl)}>
          {formatCurrency(accountData.unrealized_pnl)}
        </Row>
      </div>

      <Dialog>
        <DialogTrigger className="h-7 border border-outline text-xs text-rock/70 transition-colors hover:border-rock/40 hover:text-rock">
          View all details
        </DialogTrigger>
        <DialogContent className="max-w-sm gap-4">
          <DialogHeader>
            <DialogTitle>Account</DialogTitle>
          </DialogHeader>

          {mangoAccount && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-rock/50">Fermi Account</span>
              <button
                onClick={handleCopyMango}
                className="flex items-center gap-1.5 text-xs font-mono text-rock/70 hover:text-rock transition-colors"
              >
                {`${mangoAccount.slice(0, 4)}...${mangoAccount.slice(-4)}`}
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Row label="USDC collateral">{formatCurrency(accountData.usdc_collateral)}</Row>
            <Row label="Equity">{formatCurrency(equity)}</Row>
            <Row label="Free collateral">
              {formatCurrency(accountData.free_collateral_snapshot)}
            </Row>
            <Row label="Available withdrawal">
              {formatCurrency(accountData.available_withdrawal_snapshot)}
            </Row>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-outline pt-4">
            <Row label="Initial margin">{formatCurrency(accountData.initial_margin_snapshot)}</Row>
            <Row label="Maintenance margin">
              {formatCurrency(accountData.maintenance_margin_snapshot)}
            </Row>
            <Row label="Margin usage">{marginUsage.toFixed(2)}%</Row>
            <Row label="Max leverage">{accountData.portfolio_leverage_limit_snapshot}x</Row>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-outline pt-4">
            <Row label="Unrealized PnL" className={pnlClass(accountData.unrealized_pnl)}>
              {formatCurrency(accountData.unrealized_pnl)}
            </Row>
            <Row label="Realized PnL" className={pnlClass(accountData.realized_pnl_snapshot)}>
              {formatCurrency(accountData.realized_pnl_snapshot)}
            </Row>
            <Row label="Total realized PnL" className={pnlClass(accountData.realized_pnl_total)}>
              {formatCurrency(accountData.realized_pnl_total)}
            </Row>
            <Row label="Funding accrued" className={pnlClass(accountData.funding_accrued_snapshot)}>
              {formatCurrency(accountData.funding_accrued_snapshot)}
            </Row>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
