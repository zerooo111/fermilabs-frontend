import { useState } from 'react';
import { Loader2, Wallet2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { useAccount } from '@/shared/hooks/useAccount';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useMangoMarginDeposit } from '@/shared/hooks/useMangoMarginDeposit';
import { useSelectedMarket } from '@/entities/market';

export function MarginPanel() {
  const { publicKey } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const { requestAirdrop } = useSequencerApi();
  const { depositMargin } = useMangoMarginDeposit();
  const { data: accountData } = useAccount(publicKey?.toBase58() || '');

  const [isAirdropping, setIsAirdropping] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);

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
      .catch((err: any) =>
        posthog.capture('airdrop_failed', {
          token: quoteToken,
          error_message: err?.response?.data?.error || err?.message,
          wallet: publicKey.toBase58(),
        })
      )
      .finally(() => setIsAirdropping(false));
  };

  const handleDeposit = async () => {
    setIsDepositing(true);
    const promise = depositMargin();
    toast.promise(promise, {
      loading: 'Funding margin account...',
      success: data => (
        <div className="flex flex-col gap-1">
          <strong>Margin Funded</strong>
          <div>
            Deposited {(data?.uiAmount ?? 0).toLocaleString()} {quoteToken}
          </div>
          {data?.autoCreatedMangoAccount && <div className="text-xs">Created Mango account</div>}
        </div>
      ),
      error: (err: any) => (
        <div className="flex flex-col gap-1">
          <strong>Funding Failed</strong>
          <div>{err?.response?.data?.error || err?.message || 'Request failed'}</div>
        </div>
      ),
    });
    promise
      .then(data =>
        posthog.capture('margin_deposit', {
          token: quoteToken,
          amount: data?.uiAmount,
          auto_created_mango_account: data?.autoCreatedMangoAccount ?? false,
          wallet: publicKey.toBase58(),
        })
      )
      .catch((err: any) =>
        posthog.capture('margin_deposit_failed', {
          token: quoteToken,
          error_message: err?.response?.data?.error || err?.message,
          wallet: publicKey.toBase58(),
        })
      )
      .finally(() => setIsDepositing(false));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 space-y-3">
        <div className="space-y-1">
          <div className="text-xs text-rock/60">Available Margin</div>
          <div className="font-mono tabular-nums text-base font-semibold">
            {freeCollateral !== null
              ? `${freeCollateral.toFixed(Math.min(quoteDecimals, 2))} ${quoteToken}`
              : '——'}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleDeposit}
            disabled={isDepositing}
          >
            {isDepositing ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Deposit Margin
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-rock/60"
            onClick={handleAirdrop}
            disabled={isAirdropping}
          >
            {isAirdropping ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Airdrop Test {quoteToken}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
