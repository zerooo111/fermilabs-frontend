/**
 * Deposit and withdraw in a modal, opened from a button. The form is
 * complete, but submitting only shows a toast until the vault program is
 * wired up.
 */
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

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
import { FOCUS_RING } from '@/shared/ui/panel';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { cn } from '@/lib/utils';

import { formatDate, pct, usd } from '../model/format';
import type { Vault } from '../model/types';

/** Stand-in wallet balance until balances are read from chain. */
const DEMO_WALLET_USDC = 25_000;
const MIN_DEPOSIT = 5;
const PRESETS = [0.25, 0.5, 1];

export type VaultAction = 'deposit' | 'withdraw';

export function DepositDialog({
  vault,
  initialMode = 'deposit',
  children,
}: {
  vault: Vault;
  initialMode?: VaultAction;
  /** The button that opens the dialog. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<VaultAction>(initialMode);
  const [amount, setAmount] = useState<number | undefined>();

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setMode(initialMode);
      setAmount(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle>{vault.name}</DialogTitle>
          <DialogDescription>
            {mode === 'deposit' ? 'Deposit USDC into this vault.' : 'Withdraw USDC to your wallet.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={v => {
            setMode(v as VaultAction);
            setAmount(undefined);
          }}
        >
          <TabsList className="grid h-10 w-full grid-cols-2 border-y border-line-subtle">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>
        </Tabs>

        <Form
          vault={vault}
          mode={mode}
          amount={amount}
          setAmount={setAmount}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Form({
  vault,
  mode,
  amount,
  setAmount,
  onDone,
}: {
  vault: Vault;
  mode: VaultAction;
  amount: number | undefined;
  setAmount: (n: number | undefined) => void;
  onDone: () => void;
}) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const now = Date.now() / 1000;
  const locked = !!vault.user && vault.user.unlocksAt > now;
  const available = mode === 'deposit' ? DEMO_WALLET_USDC : (vault.user?.equity ?? 0);
  const value = amount ?? 0;

  const error =
    mode === 'deposit' && vault.status === 'closed'
      ? 'This vault is not taking new deposits.'
      : mode === 'withdraw' && !vault.user
        ? 'You have nothing in this vault.'
        : mode === 'withdraw' && locked
          ? `You can withdraw after ${formatDate(vault.user!.unlocksAt)}.`
          : value > available
            ? 'That is more than you have.'
            : mode === 'deposit' && value > 0 && value < MIN_DEPOSIT
              ? `Minimum deposit is ${usd(MIN_DEPOSIT, 0)}.`
              : null;

  const submit = () => {
    toast.success(
      `Preview only. Vault ${mode === 'deposit' ? 'deposits' : 'withdrawals'} are not live yet, so nothing was sent.`
    );
    onDone();
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-fg-tertiary">
          {mode === 'deposit' ? 'In your wallet' : 'In this vault'}
        </span>
        <span className="font-mono tabular-nums text-fg-primary">
          {publicKey ? usd(available) : '-'}
        </span>
      </div>

      <NumberInput
        name="vault-amount"
        aria-label={`${mode} amount in USDC`}
        placeholder="0.00"
        unit="USDC"
        value={amount ?? ''}
        onValueChange={v => setAmount(v.floatValue)}
        decimalScale={2}
        allowNegative={false}
        disabled={!publicKey}
        className="[&_input]:h-12 [&_input]:pr-14 [&_input]:text-lg [&>span]:bottom-3.5"
      />

      <div className="grid grid-cols-3 gap-1.5">
        {PRESETS.map(p => (
          <Button
            key={p}
            type="button"
            variant="outline"
            size="sm"
            disabled={!publicKey || available <= 0}
            onClick={() => setAmount(Math.floor(available * p * 100) / 100)}
            className={cn('font-mono text-xs', FOCUS_RING)}
          >
            {p === 1 ? 'Max' : pct(p, 0)}
          </Button>
        ))}
      </div>

      <dl className="flex flex-col gap-2 border-t border-line-subtle pt-4 text-xs">
        {mode === 'deposit' && (
          <Row label="Can withdraw after" value={formatDate(now + vault.lockupDays * 86_400)} />
        )}
        <Row
          label="Vault fee"
          value={vault.leaderFee === 0 ? 'None' : `${pct(vault.leaderFee, 0)} of profits`}
        />
      </dl>

      {!publicKey ? (
        <Button
          className={cn('h-10 w-full gap-2', FOCUS_RING)}
          onClick={() => {
            onDone();
            setVisible(true);
          }}
        >
          <Wallet className="size-4" />
          Connect wallet
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            className={cn('h-10 w-full', FOCUS_RING)}
            disabled={!!error || value <= 0}
            onClick={submit}
          >
            {mode === 'deposit' ? 'Deposit' : 'Withdraw'}
          </Button>
          {error && <p className="text-xs text-negative-fg">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-tertiary">{label}</dt>
      <dd className="font-mono tabular-nums text-fg-primary">{value}</dd>
    </div>
  );
}
