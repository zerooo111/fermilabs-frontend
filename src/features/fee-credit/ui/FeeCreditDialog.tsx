/**
 * Fee credit dialog — shows the relayer fee-credit status for the connected
 * wallet and lets the user top up the balance with a memo+transfer tx.
 */
import { useMemo, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { NumberInput } from '@/shared/ui/number-input';
import { createFeeClient, depositFeeCreditWithWallet, type FeeStatus } from '@/shared/api/fees';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';

const DEPOSIT_PRESETS_SOL = [0.01, 0.05, 0.1, 0.25];

function formatSol(lamports: number | null | undefined): string {
  if (lamports === null || lamports === undefined) return '—';
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export function FeeCreditDialog() {
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const mangoAccountPk = useAccountMangoAccount(publicKey?.toBase58());
  const queryClient = useQueryClient();
  const feeClient = useMemo(() => createFeeClient(), []);

  const [open, setOpen] = useState(false);
  const [amountSol, setAmountSol] = useState<string>('0.05');
  const [isDepositing, setIsDepositing] = useState(false);

  const statusQuery = useQuery<FeeStatus>({
    queryKey: ['fee-status', publicKey?.toBase58(), mangoAccountPk],
    queryFn: () =>
      feeClient.getStatus({
        userOwner: publicKey!.toBase58(),
        mangoAccount: mangoAccountPk!,
      }),
    enabled: open && !!publicKey && !!mangoAccountPk,
    refetchInterval: open ? 10_000 : false,
    staleTime: 5_000,
  });

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
          <div>Balance: {formatSol(data.fee_account.available_balance_lamports)} SOL</div>
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
          queryKey: ['fee-status', publicKey.toBase58(), mangoAccountPk],
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Coins className="size-3.5" />
          Fees
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fee Credit</DialogTitle>
          <DialogDescription>
            Prepaid SOL the relayer debits per intent. Top up to keep trading.
          </DialogDescription>
        </DialogHeader>

        {!mangoAccountPk ? (
          <div className="text-sm text-muted-foreground py-4">
            No Mango account found. Deposit margin first from the trade panel.
          </div>
        ) : statusQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
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
                value={`${formatSol(feeAccount?.available_balance_lamports)} SOL`}
              />
              <Row
                label="Paid credit (remaining)"
                value={formatSol(feeAccount?.paid_credit_remaining_lamports)}
              />
              <Row
                label="Sponsored (remaining)"
                value={formatSol(feeAccount?.sponsored_seed_remaining_lamports)}
              />
              <Row label="Reserved" value={formatSol(feeAccount?.reserved_lamports)} />
              <Row label="Debited total" value={formatSol(feeAccount?.debited_lamports_total)} />
              <Row label="Status" value={feeAccount?.status ?? '—'} />
            </div>

            {quote && (
              <div className="border border-outline bg-card p-3 space-y-1.5 text-xs font-mono">
                <div className="text-muted-foreground font-sans mb-1">Current quote</div>
                <Row label="Quoted fee" value={`${formatSol(quote.quoted_fee_lamports)} SOL`} />
                <Row label="Normal max" value={`${formatSol(quote.normal_max_fee_lamports)} SOL`} />
                <Row
                  label="Emergency max"
                  value={`${formatSol(quote.emergency_max_fee_lamports)} SOL`}
                />
                {quote.warning && <div className="text-warning text-xs">⚠ {quote.warning}</div>}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Top up amount</label>
                <span className="text-xs text-muted-foreground">SOL</span>
              </div>
              <div className="flex gap-1.5">
                {DEPOSIT_PRESETS_SOL.map(v => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    className={`h-8 flex-1 text-xs ${
                      amountSol === v.toString()
                        ? 'bg-white text-black font-bold hover:bg-white/90'
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
                <div className="text-[10px] text-muted-foreground font-mono break-all">
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
      <span className="text-muted-foreground font-sans">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
