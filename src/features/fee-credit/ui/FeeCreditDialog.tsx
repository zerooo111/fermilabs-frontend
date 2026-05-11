/**
 * Fee credit dialog — shows the relayer fee-credit status for the connected
 * wallet and lets the user top up the balance with a memo+transfer tx.
 */
import { useMemo, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { NumberInput } from '@/shared/ui/number-input';
import { cn } from '@/lib/utils';
import { createFeeClient, depositFeeCreditWithWallet } from '@/shared/api/fees';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';
import { useFeeStatus, formatSolFromLamports, FEE_STATUS_QUERY_KEY } from '../model/useFeeStatus';
import { feeCreditDialogOpenAtom } from '../model/feeCreditAtoms';

const DEPOSIT_PRESETS_SOL = [0.01, 0.05, 0.1, 0.25];

export function FeeCreditDialog() {
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const { isLoading: isLoadingMangoAccount } = useAccountMangoAccount(publicKey?.toBase58());
  const queryClient = useQueryClient();
  const feeClient = useMemo(() => createFeeClient(), []);

  const [open, setOpen] = useAtom(feeCreditDialogOpenAtom);
  const [amountSol, setAmountSol] = useState<string>('0.05');
  const [isDepositing, setIsDepositing] = useState(false);

  const statusQuery = useFeeStatus({ refetchInterval: open ? 10_000 : 30_000 });
  const { mangoAccountPk } = statusQuery;

  if (!publicKey) return null;

  const feeAccount = statusQuery.data?.fee_account;
  const quote = statusQuery.data?.quote;
  const deposit = statusQuery.data?.deposit;

  const handleDeposit = async () => {
    if (!anchorWallet || !mangoAccountPk) return;
    const sol = Number(amountSol);
    if (!Number.isFinite(sol) || sol <= 0) {
      toast.error('Enter a positive SOL amount');
      return;
    }
    const lamports = Math.floor(sol * LAMPORTS_PER_SOL);

    setIsDepositing(true);
    const promise = depositFeeCreditWithWallet({
      connection,
      wallet: anchorWallet,
      mangoAccount: mangoAccountPk,
      lamports,
      depositAddress: deposit?.deposit_address,
      feeClient,
    });

    toast.promise(promise, {
      loading: 'Funding fee credit...',
      success: data => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Fee Credit Funded</strong>
          </div>
          <div>
            Balance: {formatSolFromLamports(data.fee_account.available_balance_lamports)} SOL
          </div>
          {data.duplicate && <div className="text-xs">Already credited</div>}
        </div>
      ),
      error: (err: any) => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Fee Deposit Failed</strong>
          </div>
          <div>{err?.message || 'Request failed'}</div>
        </div>
      ),
    });

    promise
      .then(data => {
        posthog.capture('fee_deposit', {
          lamports,
          mango_account: mangoAccountPk,
          duplicate: data.duplicate,
          wallet: publicKey.toBase58(),
        });
        queryClient.invalidateQueries({
          queryKey: FEE_STATUS_QUERY_KEY(publicKey.toBase58(), mangoAccountPk ?? undefined),
        });
      })
      .catch((err: any) => {
        posthog.capture('fee_deposit_failed', {
          lamports,
          mango_account: mangoAccountPk,
          error_message: err?.message || 'Unknown error',
          wallet: publicKey.toBase58(),
        });
      })
      .finally(() => setIsDepositing(false));
  };

  const available = feeAccount?.available_balance_lamports ?? null;
  const quoted = quote?.quoted_fee_lamports ?? null;
  const { health } = statusQuery;
  const hasData = statusQuery.isSuccess && available !== null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'gap-2 px-2.5 font-mono tabular-nums',
                health === 'danger' &&
                  'ring-danger/60 text-danger hover:ring-danger hover:text-danger',
                health === 'warn' && 'ring-amber-400/50 text-amber-300 hover:ring-amber-400/80'
              )}
            >
              <span className="relative flex items-center">
                <Coins className="size-3.5" />
                <span
                  className={cn(
                    'absolute -right-1 -top-1 size-1.5 rounded-full ring-1 ring-background',
                    health === 'ok' && 'bg-success',
                    health === 'warn' && 'bg-amber-400 animate-pulse',
                    health === 'danger' && 'bg-danger animate-pulse',
                    health === 'unknown' && 'bg-rock/30'
                  )}
                />
              </span>
              <span className="flex items-baseline gap-1">
                <span className="font-sans text-xs text-rock/60">Fees</span>
                {hasData ? (
                  <>
                    <span className="text-sm">{formatSolFromLamports(available)}</span>
                    <span className="text-[10px] text-rock/50 font-sans tracking-wide">SOL</span>
                  </>
                ) : statusQuery.isLoading ? (
                  <span className="text-rock/40 text-sm">——</span>
                ) : null}
              </span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-mono text-xs">
          {hasData ? (
            <div className="space-y-0.5">
              <div className="font-sans text-rock/70">Relayer fee credit</div>
              <div className="flex justify-between gap-6">
                <span className="text-rock/60 font-sans">Available</span>
                <span>{formatSolFromLamports(available)} SOL</span>
              </div>
              {quoted !== null && (
                <div className="flex justify-between gap-6">
                  <span className="text-rock/60 font-sans">Quoted fee</span>
                  <span>{formatSolFromLamports(quoted)} SOL</span>
                </div>
              )}
              {health === 'danger' && (
                <div className="text-danger font-sans mt-1">Top up to keep trading</div>
              )}
              {health === 'warn' && (
                <div className="text-amber-300 font-sans mt-1">Running low</div>
              )}
            </div>
          ) : (
            <span className="font-sans">Click to manage relayer fee credit</span>
          )}
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fee Credit</DialogTitle>
          <DialogDescription>
            Prepaid SOL the relayer debits per intent. Top up to keep trading.
          </DialogDescription>
        </DialogHeader>

        {isLoadingMangoAccount ? (
          <div className="flex items-center gap-2 text-sm text-rock/60 py-4">
            <Loader2 className="size-4 animate-spin" /> Loading account...
          </div>
        ) : !mangoAccountPk ? (
          <div className="text-sm text-rock/60 py-4">
            No Fermi account found. Deposit margin first from the trade panel.
          </div>
        ) : statusQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-rock/60 py-4">
            <Loader2 className="size-4 animate-spin" /> Loading fee status...
          </div>
        ) : statusQuery.isError ? (
          <div className="text-sm text-danger py-4">
            Failed to load fee status: {(statusQuery.error as Error)?.message}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-outline bg-card p-3 space-y-1.5 text-xs font-mono">
              <Row
                label="Available"
                value={`${formatSolFromLamports(feeAccount?.available_balance_lamports)} SOL`}
              />
              <Row
                label="Paid credit (remaining)"
                value={formatSolFromLamports(feeAccount?.paid_credit_remaining_lamports)}
              />
              <Row
                label="Sponsored (remaining)"
                value={formatSolFromLamports(feeAccount?.sponsored_seed_remaining_lamports)}
              />
              <Row label="Reserved" value={formatSolFromLamports(feeAccount?.reserved_lamports)} />
              <Row
                label="Debited total"
                value={formatSolFromLamports(feeAccount?.debited_lamports_total)}
              />
              <Row label="Status" value={feeAccount?.status ?? '—'} />
            </div>

            {quote && (
              <div className="border border-outline bg-card p-3 space-y-1.5 text-xs font-mono">
                <div className="text-rock/60 font-sans mb-1">Current quote</div>
                <Row
                  label="Quoted fee"
                  value={`${formatSolFromLamports(quote.quoted_fee_lamports)} SOL`}
                />
                <Row
                  label="Normal max"
                  value={`${formatSolFromLamports(quote.normal_max_fee_lamports)} SOL`}
                />
                <Row
                  label="Emergency max"
                  value={`${formatSolFromLamports(quote.emergency_max_fee_lamports)} SOL`}
                />
                {quote.warning && <div className="text-xs text-danger">⚠ {quote.warning}</div>}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Top up amount</label>
                <span className="text-xs text-rock/60">SOL</span>
              </div>
              <div className="flex gap-1.5">
                {DEPOSIT_PRESETS_SOL.map(v => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    className={`h-8 flex-1 text-xs ${
                      amountSol === v.toString()
                        ? 'bg-rock text-background font-bold hover:bg-rock/90'
                        : ''
                    }`}
                    onClick={() => setAmountSol(v.toString())}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              <NumberInput
                id="fee-deposit-amount"
                value={amountSol}
                onValueChange={v => setAmountSol(v.value || '')}
                placeholder="0.05"
                unit="SOL"
                decimalScale={6}
                allowNegative={false}
                min={0.0001}
              />
              <Button
                className="w-full"
                disabled={isDepositing || !anchorWallet}
                onClick={handleDeposit}
              >
                {isDepositing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Funding...
                  </>
                ) : (
                  'Deposit'
                )}
              </Button>
              {deposit?.deposit_address && (
                <div className="text-[10px] text-rock/60 font-mono break-all">
                  Deposit address: {deposit.deposit_address}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-rock/60 font-sans">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
