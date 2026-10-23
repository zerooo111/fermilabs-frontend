/**
 * Deposit / withdraw form. The vault phase and the wallet's approval decide
 * the routes: a pre-deposit to escrow or a queued deposit, plus a direct
 * deposit for approved wallets; a refund of public principal, an instant or
 * queued share withdrawal, or a redemption once closed.
 */
import { useState } from 'react';
import type { PublicKey } from '@solana/web3.js';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Segmented } from '@/shared/ui/segmented';

import type { FlpEnvelope, FlpUser } from '../model/api';
import type { FlpWallet } from '../model/chain';
import { FLP_CLUSTER } from '../model/config';
import {
  formatDuration,
  formatTime,
  formatUnits,
  parseUnits,
  toInputString,
} from '../model/format';
import { useFlpActions } from '../model/useFlpActions';
import { useNow } from '../model/useNow';
import {
  depositRoutes,
  epochEnd,
  sharesValue,
  ticketBlocks,
  vaultView,
  withdrawRoutes,
  type DepositRoute,
  type VaultView,
  type WithdrawRoute,
} from '../model/view';
import { PHASE_LABEL, runAction } from './runAction';

export type FlpSide = 'deposit' | 'withdraw';
type Route = DepositRoute | WithdrawRoute;

const ROUTE_LABEL: Record<Route, string> = {
  'pre-deposit': 'Pre-deposit',
  queued: 'Queued',
  direct: 'Direct',
  refund: 'Refund',
  instant: 'Instant',
  redeem: 'Redeem',
};

export function ActionForm({
  vault,
  envelope,
  user,
  wallet,
  initialSide = 'deposit',
  onDone,
}: {
  vault: PublicKey;
  envelope: FlpEnvelope;
  user: FlpUser | null | undefined;
  wallet: FlpWallet | undefined;
  initialSide?: FlpSide;
  /** Called after a confirmed transaction. */
  onDone?: () => void;
}) {
  const v = vaultView(envelope);
  const now = useNow();
  const tx = useFlpActions(vault);
  const [side, setSide] = useState<FlpSide>(initialSide);
  const [picked, setPicked] = useState<Route | null>(null);
  const [input, setInput] = useState('');

  const shares = wallet?.shareBalance ?? BigInt(user?.sharesHeld ?? '0');
  const principal = BigInt(user?.refundablePublicPrincipal ?? '0');
  const routes =
    side === 'deposit' ? depositRoutes(envelope, user) : withdrawRoutes(envelope, user, shares);
  const current = routes.find(r => r.route === picked) ?? routes[0];
  const route = current?.route;

  const usdc = side === 'deposit' || route === 'refund';
  const decimals = usdc ? v.quoteDecimals : v.shareDecimals;
  const unit = usdc ? 'USDC' : 'FLP';
  const available =
    side === 'deposit' ? wallet?.quoteBalance : route === 'refund' ? principal : shares;
  const amount = parseUnits(input, decimals);

  let problem: string | null = null;
  if (!current) problem = withdrawUnavailable(v);
  else if (current.closed) problem = current.closed;
  else if (
    route === 'queued' &&
    side === 'deposit' &&
    ticketBlocks(user?.deposit, v.epoch.requestTarget)
  )
    problem = 'Claim or cancel your earlier deposit request first';
  else if (
    route === 'queued' &&
    side === 'withdraw' &&
    ticketBlocks(user?.withdrawal, v.epoch.requestTarget)
  )
    problem = 'Claim or cancel your earlier withdrawal request first';
  else if (input && amount === null) problem = 'Enter a valid amount';
  else if (amount !== null && available !== undefined && amount > available)
    problem =
      route === 'refund'
        ? `You have ${formatUnits(principal, decimals)} USDC pre-deposited`
        : `Exceeds your ${unit} balance`;
  else if (side === 'deposit' && amount !== null && amount > 0n && amount < v.minDeposit)
    problem = `Minimum deposit is ${formatUnits(v.minDeposit, decimals)} USDC`;
  else if (
    !usdc &&
    amount !== null &&
    amount > 0n &&
    amount < v.minWithdrawShares &&
    amount !== available
  )
    problem = `Minimum is ${formatUnits(v.minWithdrawShares, decimals)} FLP, or your full balance`;
  else if (wallet && wallet.lamports === 0n) problem = `You need ${FLP_CLUSTER} SOL for fees`;

  const canSubmit =
    !problem && !!amount && amount > 0n && user !== undefined && !tx.isPending && !!route;

  const submit = () => {
    if (!canSubmit || !amount || !route) return;
    const kind =
      route === 'pre-deposit' || (side === 'deposit' && route === 'queued')
        ? 'deposit'
        : route === 'direct'
          ? 'direct-deposit'
          : route === 'refund'
            ? 'refund'
            : route === 'instant'
              ? 'instant-withdraw'
              : 'withdraw';
    const shown = `${formatUnits(amount, decimals)} ${unit}`;
    runAction(
      tx,
      { kind, amount },
      expected => {
        if (route === 'direct' && expected !== null)
          return `Deposited ${shown} for ${formatUnits(expected, v.shareDecimals, 4)} FLP`;
        if (route === 'instant' && expected !== null)
          return `Withdrew ${shown} for ${formatUnits(expected, v.quoteDecimals, 4)} USDC`;
        if (route === 'queued')
          return side === 'deposit'
            ? `Deposit of ${shown} queued`
            : `Withdrawal of ${shown} queued`;
        if (route === 'refund') return `Refunded ${shown}`;
        if (route === 'redeem') return `Redeemed ${shown}`;
        return `Pre-deposited ${shown}`;
      },
      () => {
        setInput('');
        onDone?.();
      }
    );
  };

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          aria-label="Action"
          value={side}
          onChange={s => {
            setSide(s);
            setPicked(null);
            setInput('');
          }}
          options={[
            { value: 'deposit', label: 'Deposit' },
            { value: 'withdraw', label: 'Withdraw' },
          ]}
          className="w-max"
        />
        {routes.length > 1 && route && (
          <Segmented
            aria-label="Route"
            value={route}
            onChange={r => {
              setPicked(r);
              setInput('');
            }}
            options={routes.map(r => ({ value: r.route, label: ROUTE_LABEL[r.route] }))}
            className="w-max"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-rock/50">
            Amount
          </span>
          <span className="font-mono text-[11px] text-rock/45 tabular-nums">
            {available === undefined ? '—' : formatUnits(available, decimals)} {unit}{' '}
            {route === 'refund' ? 'pre-deposited' : 'available'}
          </span>
        </div>
        <div className="flex">
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={input}
            onChange={e => setInput(e.target.value.replace(',', '.'))}
            aria-invalid={!!problem}
            disabled={!route}
            className="font-mono tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            className="border-l-0"
            disabled={!available}
            onClick={() => available !== undefined && setInput(toInputString(available, decimals))}
          >
            Max
          </Button>
        </div>
        <p className={cn('min-h-4 text-xs', problem ? 'text-danger' : 'text-rock/50')}>
          {problem ?? (route ? routeHint(route, side, v, now, amount) : null)}
        </p>
      </div>

      {side === 'deposit' && wallet && wallet.quoteBalance === 0n && (
        <p className="border border-outline bg-card px-3 py-2 text-xs text-rock/60">
          This wallet has no test USDC on {FLP_CLUSTER}. Use the faucet under Devnet tools.
        </p>
      )}

      <Button type="submit" disabled={!canSubmit}>
        {tx.isPending
          ? PHASE_LABEL[tx.phase] || 'Preparing…'
          : side === 'deposit'
            ? route === 'pre-deposit'
              ? 'Pre-deposit'
              : 'Deposit'
            : route === 'refund'
              ? 'Refund'
              : route === 'redeem'
                ? 'Redeem'
                : 'Withdraw'}
      </Button>
    </form>
  );
}

function withdrawUnavailable(v: VaultView): string {
  if (v.mode === 'unwind') return 'The vault is unwinding. New requests wait until it finishes.';
  return 'Nothing to withdraw';
}

function routeHint(
  route: Route,
  side: FlpSide,
  v: VaultView,
  now: number,
  amount: bigint | null
): string {
  const target = v.epoch.requestTarget;
  const end = epochEnd(v, target);
  const closes = `epoch ${target}, which ends ${formatTime(end)} (in ${formatDuration(end - now)})`;
  switch (route) {
    case 'pre-deposit':
      return 'Held in escrow and refundable until graduation, which is an admin action with no fixed date. Earns no trading PnL until then.';
    case 'queued':
      return side === 'deposit'
        ? `Priced at the close of ${closes}. Cancel before the cutoff, then claim shares after the close.`
        : `Shares burn now. USDC is priced at the close of ${closes} and paid once the vault funds it.`;
    case 'direct': {
      const est =
        amount && amount > 0n
          ? ` About ${formatUnits((amount * 10n ** 6n) / (v.price || 1n), v.shareDecimals, 2)} FLP.`
          : '';
      return `Shares now at the current NAV_high price, with a 0.5% slippage limit.${est}`;
    }
    case 'refund':
      return 'Back to your wallet now, up to your pre-deposit.';
    case 'instant': {
      const est =
        amount && amount > 0n
          ? ` About ${formatUnits(sharesValue(v, amount), v.quoteDecimals, 2)} USDC.`
          : '';
      return `USDC now at the current NAV_low price, with a 0.5% slippage limit.${est}`;
    }
    case 'redeem':
      return 'Redeemed at the fixed closing ratio.';
  }
}
