import { useEffect, useRef, useState } from 'react';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Loader2 } from 'lucide-react';
import { ArrowCircleDown, CheckCircle, Info, X } from '@phosphor-icons/react';
import axios from 'axios';
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
import {
  useMangoMarginDeposit,
  type DepositContextResponse,
  type DepositPhase,
} from '@/shared/hooks/useMangoMarginDeposit';
import { fetchTokenBalance } from '@/shared/lib/solana/helpers';
import { API_ROUTES, config } from '@/shared/config/constants';

type Step = 'loading' | 'input' | 'depositing' | 'success' | 'error';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DepositModal({ open, onClose }: Props) {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const { depositMargin } = useMangoMarginDeposit();

  const [step, setStep] = useState<Step>('loading');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [quoteDecimals, setQuoteDecimals] = useState(6);
  const [mangoAccountExists, setMangoAccountExists] = useState(true);
  const [quoteToken] = useState(config.devnet.quoteTokenName);
  const [amount, setAmount] = useState('');
  const [depositedAmount, setDepositedAmount] = useState<number | null>(null);
  const [autoCreated, setAutoCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Phase-aware progress for the depositing screen so the user sees granular
  // feedback (signing → sending → confirming) instead of a single spinner.
  const [phase, setPhase] = useState<DepositPhase>('preparing');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !publicKey || !wallet) return;

    setStep('loading');
    setAmount('');
    setError(null);
    setDepositedAmount(null);
    setAutoCreated(false);
    setPhase('preparing');

    const load = async () => {
      try {
        const url = `${config.devnet.gatewayUrl}${API_ROUTES.deposit_context.replace('{pubkey}', publicKey.toBase58())}`;
        const { data } = await axios.get<DepositContextResponse>(url);

        const balanceRaw = await fetchTokenBalance(
          publicKey,
          new PublicKey(data.quote_mint),
          connection
        );
        const balanceUi = Number(balanceRaw) / Math.pow(10, data.quote_decimals);

        setQuoteDecimals(data.quote_decimals);
        setMangoAccountExists(data.mango_account_exists);
        setWalletBalance(balanceUi);
        setAmount(Math.min(balanceUi, data.default_ui_amount).toFixed(2));
        setStep('input');
        setTimeout(() => inputRef.current?.focus(), 50);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load balance');
        setStep('error');
      }
    };

    void load();
  }, [open, publicKey, wallet, connection]);

  const handleDeposit = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    setStep('depositing');
    setPhase('preparing');
    setError(null);

    try {
      const result = await depositMargin(parsed, {
        onPhase: setPhase,
      });
      setDepositedAmount(result.uiAmount);
      setAutoCreated(result.autoCreatedMangoAccount);
      setStep('success');
      posthog.capture('margin_deposit', {
        token: quoteToken,
        amount: result.uiAmount,
        auto_created_mango_account: result.autoCreatedMangoAccount,
        wallet: publicKey?.toBase58(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deposit failed';
      setError(msg);
      setStep('error');
      posthog.capture('margin_deposit_failed', {
        token: quoteToken,
        error_message: msg,
        wallet: publicKey?.toBase58(),
      });
    }
  };

  const handleClose = () => {
    if (step === 'depositing') return;
    onClose();
  };

  const parsedAmount = parseFloat(amount) || 0;
  const exceedsBalance = walletBalance !== null && parsedAmount > walletBalance;
  const canDeposit = parsedAmount > 0 && !exceedsBalance;

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
        {/* ── Loading ── */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12 px-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Loading balance…
            </p>
          </div>
        )}

        {/* ── Input ── */}
        {step === 'input' && (
          <>
            <div className="flex items-start gap-4 border-b border-outline p-5">
              <div className="flex size-10 shrink-0 items-center justify-center border border-accent/30 bg-accent/10 text-accent">
                <ArrowCircleDown weight="duotone" className="size-5" />
              </div>
              <DialogHeader className="gap-1 pt-0.5">
                <DialogTitle className="text-sm font-semibold">Deposit {quoteToken}</DialogTitle>
                <DialogDescription className="text-xs">
                  Fund your margin account to start trading.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex flex-col gap-4 p-5">
              {/* Balance row */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Amount
                </span>
                <button
                  type="button"
                  onClick={() => walletBalance !== null && setAmount(walletBalance.toFixed(2))}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-accent transition-colors"
                >
                  Wallet:{' '}
                  <span className="tabular-nums">
                    {walletBalance !== null ? walletBalance.toFixed(2) : '—'}
                  </span>{' '}
                  {quoteToken}
                </button>
              </div>

              {/* Amount input */}
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
                    if (e.key === 'Enter' && canDeposit) void handleDeposit();
                  }}
                />
                <button
                  type="button"
                  onClick={() => walletBalance !== null && setAmount(walletBalance.toFixed(2))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 border border-accent/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent hover:bg-accent/10 transition-colors"
                >
                  Max
                </button>
              </div>

              {exceedsBalance && (
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-destructive">
                  Exceeds wallet balance
                </p>
              )}

              {!mangoAccountExists && (
                <div className="flex gap-2.5 border border-outline bg-card px-3 py-2.5">
                  <Info
                    weight="duotone"
                    className="size-3.5 shrink-0 mt-0.5 text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A margin account will be created and funded in a single transaction.
                  </p>
                </div>
              )}

              <Button
                onClick={handleDeposit}
                disabled={!canDeposit}
                size="lg"
                className="w-full font-mono tracking-wide"
              >
                {parsedAmount > 0
                  ? `Deposit ${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${quoteToken}`
                  : `Deposit ${quoteToken}`}
              </Button>
            </div>
          </>
        )}

        {/* ── Depositing ── */}
        {step === 'depositing' && (
          <div className="flex flex-col gap-5 px-6 py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-12 items-center justify-center border border-accent/30 bg-accent/10">
                <Loader2 className="size-6 animate-spin text-accent" />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm font-medium">{phaseHeadline(phase)}</p>
                <p className="text-xs text-muted-foreground">{phaseSubline(phase, quoteToken)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 w-full">
              <PhaseRow label="Prepare transaction" state={rowState(phase, 'preparing')} />
              <PhaseRow label="Sign in your wallet" state={rowState(phase, 'awaiting-signature')} />
              <PhaseRow label="Submit to Solana" state={rowState(phase, 'sending')} />
              <PhaseRow label="Confirm on-chain" state={rowState(phase, 'confirming')} />
              {!mangoAccountExists && (
                <p className="mt-1 px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  This transaction creates your margin account and deposits {quoteToken} together.
                </p>
              )}
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
                  Deposit complete
                </p>
                <p className="font-mono text-3xl tabular-nums">
                  {depositedAmount?.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: quoteDecimals,
                  })}
                </p>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  {quoteToken} deposited
                </p>
                {autoCreated && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-accent/70">
                    Margin account created
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-outline p-4">
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
                <p className="text-sm font-medium">Deposit failed</p>
              </div>
              <p className="text-xs text-muted-foreground break-words leading-relaxed">{error}</p>
            </div>
            <div className="flex gap-2 border-t border-outline p-4">
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

// Order in which the hook's phases progress; used to derive whether a row is
// pending, active, or done relative to the current phase.
const PHASE_ORDER: DepositPhase[] = [
  'preparing',
  'awaiting-signature',
  'sending',
  'confirming',
  'finalizing',
];

type RowState = 'pending' | 'active' | 'done';

function rowState(current: DepositPhase, target: DepositPhase): RowState {
  const c = PHASE_ORDER.indexOf(current);
  const t = PHASE_ORDER.indexOf(target);
  if (c > t) return 'done';
  if (c === t) return 'active';
  return 'pending';
}

function phaseHeadline(phase: DepositPhase): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing transaction';
    case 'awaiting-signature':
      return 'Confirm in your wallet';
    case 'sending':
      return 'Submitting to Solana';
    case 'confirming':
      return 'Confirming on-chain';
    case 'finalizing':
      return 'Finalizing';
  }
}

function phaseSubline(phase: DepositPhase, quoteToken: string): string {
  switch (phase) {
    case 'preparing':
      return 'Building deposit instructions…';
    case 'awaiting-signature':
      return `Approve the ${quoteToken} deposit in your wallet.`;
    case 'sending':
      return 'Broadcasting your signed transaction.';
    case 'confirming':
      return 'Waiting for cluster confirmation.';
    case 'finalizing':
      return 'Updating balances…';
  }
}

function PhaseRow({ label, state }: { label: string; state: RowState }) {
  const Icon = (() => {
    switch (state) {
      case 'active':
        return <Loader2 className="size-3 shrink-0 animate-spin text-accent" />;
      case 'done':
        return <CheckCircle weight="duotone" className="size-3 shrink-0 text-success" />;
      case 'pending':
      default:
        return <div className="size-3 shrink-0 rounded-full border border-outline" />;
    }
  })();

  return (
    <div
      className={`flex w-full items-center gap-2.5 border px-3 py-2 transition-colors ${
        state === 'pending' ? 'border-outline/60 opacity-60' : 'border-outline'
      }`}
    >
      {Icon}
      <span
        className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
          state === 'done' ? 'text-foreground/80' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
