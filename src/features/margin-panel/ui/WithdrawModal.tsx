import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Loader2 } from 'lucide-react';
import { ArrowCircleUp, CheckCircle, X } from '@phosphor-icons/react';
import posthog from 'posthog-js';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { useMangoMarginDeposit } from '@/shared/hooks/useMangoMarginDeposit';
import { useAccount } from '@/shared/hooks/useAccount';
import { config } from '@/shared/config/constants';

type Step = 'input' | 'withdrawing' | 'success' | 'error';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WithdrawModal({ open, onClose }: Props) {
  const { publicKey } = useWallet();
  const { withdrawMargin } = useMangoMarginDeposit();
  const { data: accountData } = useAccount(publicKey?.toBase58() ?? '');

  const [step, setStep] = useState<Step>('input');
  const [amount, setAmount] = useState('');
  const [withdrawnAmount, setWithdrawnAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quoteToken = config.devnet.quoteTokenName;
  const maxWithdraw = accountData?.available_withdrawal_snapshot ?? null;

  useEffect(() => {
    if (!open) return;
    setStep('input');
    setAmount('');
    setError(null);
    setWithdrawnAmount(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleWithdraw = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    setStep('withdrawing');
    setError(null);

    try {
      const result = await withdrawMargin(parsed);
      setWithdrawnAmount(result.uiAmount);
      setStep('success');
      posthog.capture('margin_withdraw', {
        token: quoteToken,
        amount: result.uiAmount,
        wallet: publicKey?.toBase58(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Withdraw failed';
      setError(msg);
      setStep('error');
      posthog.capture('margin_withdraw_failed', {
        token: quoteToken,
        error_message: msg,
        wallet: publicKey?.toBase58(),
      });
    }
  };

  const handleClose = () => {
    if (step === 'withdrawing') return;
    onClose();
  };

  const parsedAmount = parseFloat(amount) || 0;
  const exceedsBalance = maxWithdraw !== null && parsedAmount > maxWithdraw + 0.005;
  const canWithdraw = parsedAmount > 0 && !exceedsBalance;

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
        {/* ── Input ── */}
        {step === 'input' && (
          <>
            <div className="flex items-start gap-4 border-b border-border p-5">
              <div className="flex size-10 shrink-0 items-center justify-center border border-accent/30 bg-accent/10 text-accent">
                <ArrowCircleUp weight="duotone" className="size-5" />
              </div>
              <DialogHeader className="gap-1 pt-0.5">
                <DialogTitle className="text-sm font-semibold">Withdraw {quoteToken}</DialogTitle>
                <DialogDescription className="text-xs">
                  Withdraw funds from your margin account to your wallet.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Amount
                </span>
                <button
                  type="button"
                  onClick={() =>
                    maxWithdraw !== null &&
                    setAmount((Math.floor(maxWithdraw * 100) / 100).toFixed(2))
                  }
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-accent transition-colors"
                >
                  Available:{' '}
                  <span className="tabular-nums">
                    {maxWithdraw !== null ? maxWithdraw.toFixed(2) : '—'}
                  </span>{' '}
                  {quoteToken}
                </button>
              </div>

              <div className="relative">
                <Input
                  ref={inputRef}
                  type="number"
                  min={0}
                  step={0.01}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-11 pr-14 font-mono text-base tabular-nums"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && canWithdraw) void handleWithdraw();
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    maxWithdraw !== null &&
                    setAmount((Math.floor(maxWithdraw * 100) / 100).toFixed(2))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 border border-accent/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent hover:bg-accent/10 transition-colors"
                >
                  Max
                </button>
              </div>

              <div className="flex items-center justify-between">
                {exceedsBalance ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-destructive">
                    Exceeds available balance
                  </p>
                ) : (
                  <p className="font-mono text-[10px] text-muted-foreground/50 tracking-[0.1em]">
                    Snapshot balance · ±0.005 {quoteToken} tolerance
                  </p>
                )}
              </div>

              {maxWithdraw === 0 && (
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  No funds available to withdraw
                </p>
              )}

              <Button
                onClick={handleWithdraw}
                disabled={!canWithdraw}
                size="lg"
                className="w-full font-mono tracking-wide"
              >
                {parsedAmount > 0
                  ? `Withdraw ${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${quoteToken}`
                  : `Withdraw ${quoteToken}`}
              </Button>
            </div>
          </>
        )}

        {/* ── Withdrawing ── */}
        {step === 'withdrawing' && (
          <div className="flex flex-col items-center gap-5 px-6 py-12">
            <div className="flex size-12 items-center justify-center border border-accent/30 bg-accent/10">
              <Loader2 className="size-6 animate-spin text-accent" />
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="text-sm font-medium">Confirm in your wallet</p>
              <p className="text-xs text-muted-foreground">Withdrawing {quoteToken}…</p>
            </div>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="flex flex-col gap-0">
            <div className="flex flex-col items-center gap-4 px-6 py-10">
              <div className="flex size-12 items-center justify-center border border-accent/30 bg-accent/10 text-accent">
                <CheckCircle weight="duotone" className="size-6" />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Withdrawal complete
                </p>
                <p className="font-mono text-3xl tabular-nums">
                  {withdrawnAmount?.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  {quoteToken} sent to wallet
                </p>
              </div>
            </div>
            <div className="border-t border-border p-4">
              <Button onClick={onClose} size="lg" className="w-full font-mono tracking-wide">
                Done
              </Button>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <div className="flex flex-col gap-0">
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <X className="size-4 text-destructive" />
                <p className="text-sm font-medium">Withdrawal failed</p>
              </div>
              <p className="text-xs text-muted-foreground break-words leading-relaxed">{error}</p>
            </div>
            <div className="flex gap-2 border-t border-border p-4">
              <Button variant="outline" onClick={handleClose} className="flex-1 font-mono text-xs">
                Cancel
              </Button>
              <Button onClick={() => setStep('input')} className="flex-1 font-mono text-xs">
                Try again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
