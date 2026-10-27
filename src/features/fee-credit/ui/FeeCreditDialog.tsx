/**
 * Fee credit dialog — shows the relayer fee-credit status for the connected
 * wallet and lets the user top up the balance with a memo+transfer tx.
 * Controlled by `feeCreditDialogOpenAtom`: the header's balances menu and the
 * order form open it.
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
} from '@/shared/ui/dialog';
import { NumberInput } from '@/shared/ui/number-input';
import { createFeeClient, depositFeeCreditWithWallet } from '@/shared/api/fees';
import { config } from '@/shared/config/constants';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';
import { formatSol, requiredLamports, solFromLamports } from '@/shared/lib/solana/gas';
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

    // The top-up plus the fee to send it. Without this the wallet prompt opens
    // on a transaction that can't pay, which Phantom flags as an unsafe dApp.
    const needed = lamports + requiredLamports({ needsAccountCreation: false });
    const balance = await connection.getBalance(publicKey, config.devnet.commitment);
    if (balance < needed) {
      toast.error(
        `This top-up needs about ${formatSol(solFromLamports(needed))} SOL with network fees. You have ${formatSol(solFromLamports(balance))} SOL.`
      );
      return;
    }

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
