/**
 * Balances menu for the header: trading margin (USDC) and relayer fee credit
 * (SOL) behind one button. The button shows margin; a dot on its icon flags
 * fee credit only when it runs low, so the fee balance needs no button of its
 * own. Also hosts the first-deposit onboarding guide, anchored to the button.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Wallet2,
  X,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSetAtom } from 'jotai';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/ui/popover';
import { useAccount } from '@/shared/hooks/useAccount';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useSelectedMarket } from '@/entities/market';
import { useOnboarding } from '@/features/onboarding/model/useOnboarding';
import {
  feeCreditDialogOpenAtom,
  formatSolFromLamports,
  useFeeStatus,
  type FeeHealth,
} from '@/features/fee-credit';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';

const EYEBROW = 'font-mono text-[10px] uppercase tracking-[0.15em] text-rock/55';

const FEE_HEALTH: Record<FeeHealth, { label: string; dot: string; text: string }> = {
  ok: { label: 'Healthy', dot: 'bg-success', text: 'text-rock/60' },
  warn: { label: 'Running low', dot: 'bg-amber-200 animate-pulse', text: 'text-amber-200' },
  danger: { label: 'Top up to trade', dot: 'bg-danger animate-pulse', text: 'text-danger' },
  unknown: { label: '', dot: 'bg-rock/30', text: 'text-rock/60' },
};

export function MarginPanel() {
  const { publicKey } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const { requestAirdrop } = useSequencerApi();
  const { data: accountData } = useAccount(publicKey?.toBase58() || '');

  const [isAirdropping, setIsAirdropping] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const setFeeCreditOpen = useSetAtom(feeCreditDialogOpenAtom);
  const fee = useFeeStatus();
  const feeAvailable = fee.data?.fee_account.available_balance_lamports ?? null;
  const feeAlert = fee.health === 'warn' || fee.health === 'danger';

  // Onboarding guide — shown once per wallet, pointing at this button.
  const walletKey = publicKey?.toBase58() ?? null;
  const { shouldShow, dismiss } = useOnboarding(walletKey);

  const freeCollateral = accountData?.free_collateral_snapshot ?? null;

  // Delay the guide slightly so the page finishes rendering first.
  // Only show when the user has zero free collateral — the guide is for
  // first-time depositors, not users who already have funds.
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    if (!shouldShow) return;
    if (freeCollateral === null || freeCollateral > 0) return;
    const t = setTimeout(() => setGuideVisible(true), 700);
    return () => clearTimeout(t);
  }, [shouldShow, freeCollateral]);

  if (!publicKey) return null;
  const quoteDecimals = selectedMarket?.quoteDecimals ?? 2;
  const quoteToken = selectedMarket?.quoteTokenName ?? 'USDC';
  const margin =
    freeCollateral !== null ? freeCollateral.toFixed(Math.min(quoteDecimals, 2)) : null;

  const handleAirdrop = async () => {
    setIsAirdropping(true);
    const promise = requestAirdrop(publicKey.toBase58());
    toast.promise(promise, {
      loading: 'Minting test USDC...',
      success: data => (
        <div className="flex flex-col gap-1">
          <strong>Airdrop Complete</strong>
          <div>
            Minted {(data?.ui_amount ?? 0).toLocaleString()} {quoteToken}
          </div>
        </div>
      ),
      error: (err: any) => (
        <div className="flex flex-col gap-1">
          <strong>Airdrop Failed</strong>
          <div>{err?.response?.data?.error || err?.message || 'Request failed'}</div>
        </div>
      ),
    });
    promise
      .then(data =>
        posthog.capture('airdrop_requested', {
          token: quoteToken,
          amount: data?.ui_amount,
          wallet: publicKey.toBase58(),
        })
      )
      .catch((err: any) => {
        console.error('[margin] airdrop failed', err);
        posthog.capture('airdrop_failed', {
          token: quoteToken,
          error_message: err?.response?.data?.error || err?.message,
          wallet: publicKey.toBase58(),
        });
      })
      .finally(() => setIsAirdropping(false));
  };

  const handleGuideDeposit = () => {
    dismiss();
    setGuideVisible(false);
    setDepositOpen(true);
  };

  const handleGuideDismiss = () => {
    dismiss();
    setGuideVisible(false);
  };

  return (
    <>
      {/* Dim + blur overlay — sits above page content (z-40) but below the
          button and popover (z-[50]). Clicking anywhere on it dismisses. */}
      {guideVisible &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={handleGuideDismiss}
          />,
          document.body
        )}

      {/* Popover is anchored to the margin button and auto-opens for the guide.
          PopoverAnchor (not PopoverTrigger) so clicks still reach the DropdownMenu. */}
      <Popover open={guideVisible}>
        <PopoverAnchor asChild>
          {/* relative z-[50] lifts the button above the overlay in the root
              stacking context (the nav has no position so no stacking ctx). */}
          <div className={`relative ${guideVisible ? 'z-[50]' : ''}`}>
            {/* Pulsing beacon — draws the eye to the button */}
            {guideVisible && (
              <span className="absolute -top-1 -right-1 flex size-2.5 z-10 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 text-dark-forest opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-amber-200 text-dark-forest" />
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 px-2.5 font-mono tabular-nums"
                  aria-label={`Balances${feeAlert ? `, fee credit ${FEE_HEALTH[fee.health].label.toLowerCase()}` : ''}`}
                >
                  <span className="relative flex items-center">
                    <Wallet2 className="size-3.5 shrink-0" />
                    {feeAlert && (
                      <span
                        className={cn(
                          'absolute -right-1 -top-1 size-1.5 rounded-full ring-1 ring-background',
                          FEE_HEALTH[fee.health].dot
                        )}
                      />
                    )}
                  </span>
                  <span className="flex items-baseline gap-1">
                    <span className="hidden text-xs text-rock/60 font-sans xl:inline">Margin</span>
                    {margin !== null ? (
                      <>
                        <span className="text-sm">{margin}</span>
                        <span className="text-[10px] text-rock/50 font-sans">{quoteToken}</span>
                      </>
                    ) : (
                      <span className="text-rock/40 text-sm">——</span>
                    )}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-64 p-0">
                {/* ── Trading margin ── */}
                <div className="flex flex-col gap-1 p-1 pt-2.5">
                  <div className="flex items-baseline justify-between px-2 pb-1">
                    <span className={EYEBROW}>Trading margin</span>
                    <span className="font-mono text-sm tabular-nums text-rock">
                      {margin ?? '——'}{' '}
                      <span className="text-[10px] text-rock/50 font-sans">{quoteToken}</span>
                    </span>
                  </div>
                  <DropdownMenuItem
                    onClick={() => {
                      dismiss();
                      setDepositOpen(true);
                    }}
                    className="text-xs"
                  >
                    <ArrowDownToLine className="size-3.5" />
                    Deposit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setWithdrawOpen(true)} className="text-xs">
                    <ArrowUpFromLine className="size-3.5" />
                    Withdraw
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleAirdrop}
                    disabled={isAirdropping}
                    className="text-xs text-rock/60"
                  >
                    {isAirdropping ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Wallet2 className="size-3.5" />
                    )}
                    Airdrop test {quoteToken}
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="mx-0 my-0" />

                {/* ── Fee credit ── */}
                <div className="flex flex-col gap-1 p-1 pt-2.5">
                  <div className="flex items-baseline justify-between px-2">
                    <span className={EYEBROW}>Fee credit</span>
                    <span className="font-mono text-sm tabular-nums text-rock">
                      {feeAvailable !== null ? formatSolFromLamports(feeAvailable) : '——'}{' '}
                      <span className="text-[10px] text-rock/50 font-sans">SOL</span>
                    </span>
                  </div>
                  {FEE_HEALTH[fee.health].label && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 pb-1 text-[11px]',
                        FEE_HEALTH[fee.health].text
                      )}
                    >
                      <span className={cn('size-1.5 rounded-full', FEE_HEALTH[fee.health].dot)} />
                      {FEE_HEALTH[fee.health].label}
                    </span>
                  )}
                  <DropdownMenuItem onClick={() => setFeeCreditOpen(true)} className="text-xs">
                    <Coins className="size-3.5" />
                    {feeAlert ? 'Top up fee credit' : 'Manage fee credit'}
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PopoverAnchor>

        {/* Guide callout — appears below the button */}
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={10}
          className="w-64 p-0 overflow-hidden"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          {/* Arrow indicator */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-outline">
            <span className="text-xs font-medium text-rock">Start by depositing USDC</span>
            <button
              onClick={handleGuideDismiss}
              className="ml-auto text-rock/50 hover:text-rock transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="px-3 py-3 space-y-3">
            <p className="text-xs text-rock/50 leading-relaxed">
              Add USDC as collateral to your margin account before placing your first trade.
            </p>
            <Button size="sm" className="w-full gap-1.5" onClick={handleGuideDeposit}>
              Deposit USDC
              <ArrowRight className="size-3.5" />
            </Button>
            <button
              onClick={handleGuideDismiss}
              className="w-full text-[11px] text-rock/50 hover:text-rock transition-colors"
            >
              I'll do it later
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </>
  );
}
