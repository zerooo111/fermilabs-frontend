import { useState, useEffect } from 'react';
import { Loader2, Wallet2, X, ArrowRight } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/ui/popover';
import { useAccount } from '@/shared/hooks/useAccount';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useSelectedMarket } from '@/entities/market';
import { useOnboarding } from '@/features/onboarding/model/useOnboarding';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';

export function MarginPanel() {
  const { publicKey } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const { requestAirdrop } = useSequencerApi();
  const { data: accountData } = useAccount(publicKey?.toBase58() || '');

  const [isAirdropping, setIsAirdropping] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Onboarding guide — shown once per wallet, pointing at this button.
  const walletKey = publicKey?.toBase58() ?? null;
  const { shouldShow, dismiss } = useOnboarding(walletKey);

  // Delay the guide slightly so the page finishes rendering first.
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    if (!shouldShow) return;
    const t = setTimeout(() => setGuideVisible(true), 700);
    return () => clearTimeout(t);
  }, [shouldShow]);

  if (!publicKey) return null;

  const freeCollateral = accountData?.free_collateral_snapshot ?? null;
  const quoteDecimals = selectedMarket?.quoteDecimals ?? 2;
  const quoteToken = selectedMarket?.quoteTokenName ?? 'USDC';

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
      {/* Popover is anchored to the margin button and auto-opens for the guide.
          PopoverAnchor (not PopoverTrigger) so clicks still reach the DropdownMenu. */}
      <Popover open={guideVisible}>
        <PopoverAnchor asChild>
          <div className="relative">
            {/* Pulsing beacon — draws the eye to the button */}
            {guideVisible && (
              <span className="absolute -top-1 -right-1 flex size-2.5 z-10 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-primary" />
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 px-2.5 font-mono tabular-nums">
                  <Wallet2 className="size-3.5 shrink-0" />
                  <span className="flex items-baseline gap-1">
                    <span className="text-xs text-rock/60 font-sans">Margin</span>
                    {freeCollateral !== null ? (
                      <>
                        <span className="text-sm">
                          {freeCollateral.toFixed(Math.min(quoteDecimals, 2))}
                        </span>
                        <span className="text-[10px] text-rock/50 font-sans">{quoteToken}</span>
                      </>
                    ) : (
                      <span className="text-rock/40 text-sm">——</span>
                    )}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-mono tabular-nums">
                  {freeCollateral !== null
                    ? `${freeCollateral.toFixed(Math.min(quoteDecimals, 2))} ${quoteToken}`
                    : '——'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    dismiss();
                    setDepositOpen(true);
                  }}
                >
                  <Wallet2 className="size-4" />
                  Deposit Margin
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWithdrawOpen(true)}>
                  <Wallet2 className="size-4" />
                  Withdraw Margin
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleAirdrop}
                  disabled={isAirdropping}
                  className="text-rock/60"
                >
                  {isAirdropping ? <Loader2 className="size-4 animate-spin" /> : null}
                  Airdrop Test {quoteToken}
                </DropdownMenuItem>
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
            <span className="text-xs font-medium text-foreground">Start by depositing USDC</span>
            <button
              onClick={handleGuideDismiss}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="px-3 py-3 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add USDC as collateral to your margin account before placing your first trade.
            </p>
            <Button size="sm" className="w-full gap-1.5" onClick={handleGuideDeposit}>
              Deposit USDC
              <ArrowRight className="size-3.5" />
            </Button>
            <button
              onClick={handleGuideDismiss}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors"
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
