import { useState } from 'react';
import { Loader2, Wallet2 } from 'lucide-react';
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
import { useAccount } from '@/shared/hooks/useAccount';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useSelectedMarket } from '@/entities/market';
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

  return (
    <>
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
          <DropdownMenuItem onClick={() => setDepositOpen(true)}>
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

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </>
  );
}
