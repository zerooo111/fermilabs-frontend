/**
 * Deposit / withdraw form for an FLP vault, used in the vault page's dialog.
 *
 * The vault phase and the wallet decide the routes (model/view.ts): before
 * launch a deposit waits in escrow; after it, requests settle at the next
 * epoch close and are claimed. Approved wallets also get instant routes. The
 * user sees plain words: what they pay, what they get, when, and whether
 * they can undo it. A confirmed transaction ends on a success step.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { PublicKey } from '@solana/web3.js';
import { Check, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Segmented } from '@/shared/ui/segmented';

import type { FlpTicket } from '../model/api';
import { FLP_CLUSTER, flpExplorerTxUrl } from '../model/config';
import {
  formatDuration,
  formatTime,
  formatUnits,
  parseUnits,
  PRICE_DECIMALS,
  toInputString,
} from '../model/format';
import {
  TOLERANCE_BPS,
  useFlpActions,
  type FlpActionKind,
  type FlpActionResult,
} from '../model/useFlpActions';
import { useFlpVault } from '../model/useFlpVault';
import { useNow } from '../model/useNow';
import {
  depositRoutes,
  epochEnd,
  sharesValue,
  ticketBlocks,
  upnlRisk,
  vaultView,
  withdrawRoutes,
  type DepositRoute,
  type VaultView,
  type WithdrawRoute,
} from '../model/view';
import { DevnetWalletButton } from './DevnetWallet';
import { PHASE_LABEL } from './phase';

export type FlpSide = 'deposit' | 'withdraw';
type Route = DepositRoute | WithdrawRoute;

const SLIPPAGE = `${Number(TOLERANCE_BPS) / 100}%`;

/** Route names as the user reads them. */
const ROUTE_LABEL: Record<Route, string> = {
  'pre-deposit': 'Standard',
  queued: 'Standard',
  direct: 'Instant',
  refund: 'Pre-deposit',
  instant: 'Instant',
  redeem: 'Redeem',
};

const KIND: Record<FlpSide, Partial<Record<Route, FlpActionKind>>> = {
  deposit: { 'pre-deposit': 'deposit', queued: 'deposit', direct: 'direct-deposit' },
  withdraw: {
    refund: 'refund',
    instant: 'instant-withdraw',
    queued: 'withdraw',
    redeem: 'withdraw',
  },
};

interface Done {
  route: Route;
  side: FlpSide;
  amount: bigint;
  result: FlpActionResult;
}

export function ActionForm({
  vault,
  side,
  onSideChange,
  onClose,
}: {
  vault: PublicKey;
  side: FlpSide;
  onSideChange: (side: FlpSide) => void;
  /** Leave the form (the dialog closes). */
  onClose?: () => void;
}) {
  const { envelope, user, userLoading, wallet, owner, syncing, readOnly } = useFlpVault(vault);
  const [done, setDone] = useState<Done | null>(null);

  if (!owner) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-rock/70">
          Connect a devnet wallet to {side}. This vault is on devnet, so it uses your wallet
          extension directly, not your Fermi login.
        </p>
        <DevnetWalletButton size="default" />
      </div>
    );
  }
  if (!envelope) return <Loading />;
  if (done) {
    return (
      <Success
        done={done}
        v={vaultView(envelope)}
        onAgain={() => setDone(null)}
        onClose={onClose}
      />
    );
  }
  return (
    <Form
      vault={vault}
      side={side}
      onSideChange={onSideChange}
      envelope={envelope}
      user={userLoading ? undefined : user}
      wallet={wallet.data}
      syncing={syncing}
      readOnly={readOnly}
      onDone={setDone}
    />
  );
}

function Form({
  vault,
  side,
  onSideChange,
  envelope,
  user,
  wallet,
  syncing,
  readOnly,
  onDone,
}: {
  vault: PublicKey;
  side: FlpSide;
  readOnly: boolean;
  onSideChange: (side: FlpSide) => void;
  envelope: NonNullable<ReturnType<typeof useFlpVault>['envelope']>;
  user: ReturnType<typeof useFlpVault>['user'];
  wallet: ReturnType<typeof useFlpVault>['wallet']['data'];
  syncing: boolean;
  onDone: (done: Done) => void;
}) {
  const ids = useId();
  const v = vaultView(envelope);
  const now = useNow();
  const tx = useFlpActions(vault);
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
  // Room left under the shared cap; unknown while the vault can't be valued.
  const capLeft = v.tvl === null ? null : v.tvlCap > v.tvl ? v.tvlCap - v.tvl : 0n;
  const balance =
    side === 'deposit' ? wallet?.quoteBalance : route === 'refund' ? principal : shares;
  const max =
    balance !== undefined && side === 'deposit' && capLeft !== null && capLeft < balance
      ? capLeft
      : balance;
  const amount = parseUnits(input, decimals);

  // A new queued request can't sit beside a ticket left for another epoch.
  const blocking: FlpTicket | undefined =
    route === 'queued'
      ? side === 'deposit'
        ? ticketBlocks(user?.deposit, v.epoch.requestTarget)
          ? user?.deposit
          : undefined
        : ticketBlocks(user?.withdrawal, v.epoch.requestTarget)
          ? user?.withdrawal
          : undefined
      : undefined;

  let problem: string | null = null;
  let amountProblem = false;
  if (!current) problem = noRoute(side, v);
  else if (current.closed) problem = current.closed;
  else if (blocking) problem = null;
  else if (amount !== null && balance !== undefined && amount > balance) {
    amountProblem = true;
    problem =
      route === 'refund'
        ? `You have ${formatUnits(principal, decimals)} USDC pre-deposited`
        : `More than your ${formatUnits(balance, decimals, 4)} ${unit}`;
  } else if (side === 'deposit' && amount !== null && capLeft !== null && amount > capLeft) {
    amountProblem = true;
    problem = `Only ${formatUnits(capLeft, decimals, 2)} USDC of room left in this vault`;
  } else if (side === 'deposit' && amount !== null && amount > 0n && amount < v.minDeposit) {
    amountProblem = true;
    problem = `The minimum deposit is ${formatUnits(v.minDeposit, decimals)} USDC`;
  } else if (
    !usdc &&
    amount !== null &&
    amount > 0n &&
    amount < v.minWithdrawShares &&
    amount !== balance
  ) {
    amountProblem = true;
    problem = `The minimum is ${formatUnits(v.minWithdrawShares, decimals)} FLP, or all of it`;
  } else if (wallet && wallet.lamports === 0n)
    problem = `You need a little ${FLP_CLUSTER} SOL for fees. Use “Get devnet SOL” above.`;

  const waiting = readOnly
    ? 'Read-only dev view'
    : user === undefined
      ? 'Loading your account…'
      : syncing
        ? 'Updating…'
        : null;
  const canSubmit =
    !problem && !blocking && !waiting && !!amount && amount > 0n && !tx.isPending && !!route;

  const submit = () => {
    if (!canSubmit || !amount || !route) return;
    const kind = KIND[side][route]!;
    const shown = `${formatUnits(amount, decimals)} ${unit}`;
    tx.run(
      {
        kind,
        amount,
        success: expected =>
          route === 'direct' && expected !== null
            ? `Deposited ${shown} for ${formatUnits(expected, v.shareDecimals, 4)} FLP`
            : route === 'instant' && expected !== null
              ? `Withdrew ${shown} for ${formatUnits(expected, v.quoteDecimals, 2)} USDC`
              : route === 'queued'
                ? side === 'deposit'
                  ? `Deposit of ${shown} requested`
                  : `Withdrawal of ${shown} requested`
                : route === 'refund'
                  ? `${shown} back in your wallet`
                  : route === 'redeem'
                    ? `Redeemed ${shown}`
                    : `Deposited ${shown}`,
      },
      result => {
        setInput('');
        onDone({ route, side, amount, result });
      }
    );
  };

  const pendingLabel = tx.isPending ? PHASE_LABEL[tx.phase] || 'Working…' : null;

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <Segmented
        aria-label="Action"
        size="md"
        value={side}
        onChange={s => {
          onSideChange(s);
          setPicked(null);
          setInput('');
        }}
        options={[
          { value: 'deposit', label: 'Deposit' },
          { value: 'withdraw', label: 'Withdraw' },
        ]}
      />

      {routes.length > 1 && route && (
        <div className="flex flex-col gap-1.5">
          <span id={`${ids}-route`} className="text-xs text-rock/60">
            How
          </span>
          <Segmented
            aria-label="How"
            size="md"
            value={route}
            onChange={r => {
              setPicked(r);
              setInput('');
            }}
            options={routes.map(r => ({ value: r.route, label: ROUTE_LABEL[r.route] }))}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${ids}-amount`} className="text-xs text-rock/60">
            Amount
          </label>
          <span className="font-mono text-[11px] text-rock/60 tabular-nums">
            {balance === undefined ? '—' : formatUnits(balance, decimals, 4)} {unit}{' '}
            {route === 'refund' ? 'pre-deposited' : 'available'}
          </span>
        </div>
        <div className="flex">
          <Input
            id={`${ids}-amount`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={input}
            onChange={e => setInput(clampDecimals(e.target.value.replace(',', '.'), decimals))}
            aria-invalid={amountProblem}
            aria-describedby={`${ids}-note`}
            disabled={!route}
            className="h-10 font-mono tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 border-l-0"
            disabled={!max}
            onClick={() => max !== undefined && setInput(toInputString(max, decimals))}
          >
            Max
          </Button>
        </div>
        <p
          id={`${ids}-note`}
          role={problem ? 'alert' : undefined}
          className={cn('min-h-4 text-xs', problem ? 'text-danger' : 'text-rock/60')}
        >
          {problem}
        </p>
      </div>

      {blocking && <Blocking vault={vault} ticket={blocking} side={side} v={v} />}

      {route && !blocking && (
        <Summary route={route} side={side} amount={amount} v={v} now={now} envelope={envelope} />
      )}

      {side === 'deposit' && wallet && wallet.quoteBalance === 0n && (
        <p className="border border-outline bg-card px-3 py-2 text-xs text-rock/70">
          This wallet has no test USDC. Use “Get test USDC” above the vault stats.
        </p>
      )}

      <Button type="submit" size="lg" disabled={!canSubmit}>
        {pendingLabel ?? waiting ?? submitLabel(side, route)}
      </Button>
    </form>
  );
}

function submitLabel(side: FlpSide, route: Route | undefined): string {
  switch (route) {
    case 'pre-deposit':
      return 'Deposit';
    case 'direct':
      return 'Deposit now';
    case 'queued':
      return side === 'deposit' ? 'Request deposit' : 'Request withdrawal';
    case 'refund':
      return 'Withdraw pre-deposit';
    case 'instant':
      return 'Withdraw now';
    case 'redeem':
      return 'Redeem';
    default:
      return side === 'deposit' ? 'Deposit' : 'Withdraw';
  }
}

function noRoute(side: FlpSide, v: VaultView): string {
  if (side === 'deposit')
    return v.mode === 'unwind' || v.mode === 'closed'
      ? 'This vault no longer takes deposits.'
      : 'Deposits are closed right now.';
  if (v.mode === 'unwind') return 'Withdrawals wait until the vault finishes unwinding.';
  return 'Nothing to withdraw from this vault.';
}

/** "Settles 14:05 (in 4m 12s)" for the epoch a new request lands in. */
function settlement(v: VaultView, now: number) {
  const end = epochEnd(v, v.epoch.requestTarget);
  const cutoff = end - v.params.requestCutoffS;
  return {
    at: end > now ? `${formatTime(end)} (in ${formatDuration(end - now)})` : 'Settling now',
    cancelUntil: formatTime(cutoff),
  };
}

/** What the user pays and gets, and when: the same block for every route. */
function Summary({
  route,
  side,
  amount,
  v,
  now,
  envelope,
}: {
  route: Route;
  side: FlpSide;
  amount: bigint | null;
  v: VaultView;
  now: number;
  envelope: Parameters<typeof upnlRisk>[0];
}) {
  const a = amount ?? 0n;
  const usd = (n: bigint) => `${formatUnits(n, v.quoteDecimals, 2)} USDC`;
  const flp = (n: bigint) => `${formatUnits(n, v.shareDecimals, 4)} FLP`;
  // Shares for a USDC amount at the last-close reference price.
  const toShares = (n: bigint) => (n * 10n ** BigInt(PRICE_DECIMALS)) / (v.price || 1n);
  const when = settlement(v, now);
  const risk = upnlRisk(envelope);

  const rows: Array<[string, ReactNode]> = [];
  switch (route) {
    case 'pre-deposit':
      rows.push(
        ['You pay', usd(a)],
        ['Held', 'In escrow until launch'],
        ['Withdraw', 'Any time before launch'],
        ['Earnings', 'Start at launch (date set by Fermi)']
      );
      break;
    case 'queued':
      if (side === 'deposit')
        rows.push(
          ['You pay', usd(a)],
          ['You receive', `≈ ${flp(toShares(a))}`],
          ['Priced at', `Next settlement, ${when.at}`],
          ['Cancel until', when.cancelUntil]
        );
      else
        rows.push(
          ['You withdraw', `${flp(a)}, locked now`],
          ['You receive', `≈ ${usd(sharesValue(v, a))}`],
          ['Priced at', `Next settlement, ${when.at}`],
          ['Cancel until', when.cancelUntil]
        );
      break;
    case 'direct':
      rows.push(
        ['You pay', usd(a)],
        ['You receive', `≈ ${flp(toShares(a))} now`],
        ['Slippage', `At most ${SLIPPAGE}`]
      );
      break;
    case 'refund':
      rows.push(['You receive', `${usd(a)} now`]);
      break;
    case 'instant':
      rows.push(
        ['You withdraw', flp(a)],
        ['You receive', `≈ ${usd(sharesValue(v, a))} now`],
        ['Slippage', `At most ${SLIPPAGE}`]
      );
      break;
    case 'redeem':
      rows.push(['You redeem', flp(a)], ['You receive', `≈ ${usd(sharesValue(v, a))}`]);
      break;
  }

  return (
    <div className="flex flex-col border border-outline">
      <dl className="divide-y divide-outline">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <dt className="text-xs text-rock/60">{label}</dt>
            <dd className="text-right font-mono text-xs tabular-nums text-rock">{value}</dd>
          </div>
        ))}
      </dl>
      {side === 'deposit' && (
        // Required with every deposit, even when the amount is unknown
        // (INTEGRATION_GUIDE.md "Values and UI disclosures").
        <p className="border-t border-outline px-3 py-2 text-[11px] leading-relaxed text-rock/60">
          {risk?.amount != null && risk.bps != null
            ? `Unsettled profit in the vault: ${usd(risk.amount)} (${(risk.bps / 100).toFixed(2)}% of its value), ${risk.disclosure}.`
            : `Unsettled profit in the vault is unknown right now. Positive unsettled profit is ${risk?.disclosure ?? 'counted at par when you enter, excluded when you exit'}.`}
        </p>
      )}
    </div>
  );
}

/** An older request is in the way: offer its claim or cancel right here. */
function Blocking({
  vault,
  ticket,
  side,
  v,
}: {
  vault: PublicKey;
  ticket: FlpTicket;
  side: FlpSide;
  v: VaultView;
}) {
  const tx = useFlpActions(vault);
  const deposit = side === 'deposit';
  const claimable = BigInt(ticket.claimable);
  let text: string;
  let action: { kind: FlpActionKind; label: string; success: string } | null = null;
  if (ticket.state === 'claimable-shares') {
    const got = `${formatUnits(claimable, v.shareDecimals, 4)} FLP`;
    text = `Your last deposit settled: ${got} are ready. Claim them before a new deposit.`;
    action = { kind: 'claim-deposit', label: 'Claim FLP', success: `Claimed ${got}` };
  } else if (ticket.state === 'refund-only') {
    const got = `${formatUnits(claimable, v.quoteDecimals, 2)} USDC`;
    text = `Your last deposit wasn’t accepted. Take back ${got} first.`;
    action = {
      kind: 'claim-deposit',
      label: 'Get USDC back',
      success: `${got} back in your wallet`,
    };
  } else if (ticket.state === 'funded-claimable') {
    const got = `${formatUnits(claimable, v.quoteDecimals, 2)} USDC`;
    text = `Your last withdrawal paid out: ${got} is ready. Claim it before a new one.`;
    action = { kind: 'claim-withdrawal', label: 'Claim USDC', success: `Claimed ${got}` };
  } else if (ticket.state === 'queued' && ticket.cancellable) {
    text = `You have a ${side} request waiting for the current settlement. Cancel it to request again, or wait for it to settle.`;
    action = {
      kind: deposit ? 'cancel-deposit' : 'cancel-withdraw',
      label: 'Cancel request',
      success: deposit ? 'Deposit request cancelled' : 'Withdrawal request cancelled',
    };
  } else if (ticket.state === 'deferred') {
    text = v.funding
      ? `Your last withdrawal is waiting for funding; the window is open until ${formatTime(v.funding.deadline)}. A new one can follow once it pays out.`
      : 'Your last withdrawal is waiting for liquidity. A new one can follow once it pays out.';
  } else {
    text = `Your last ${side} request is still settling. You can request again once it’s done.`;
  }
  return (
    <div className="flex flex-col gap-2.5 border border-amber-200/40 bg-amber-200/[0.05] px-3 py-3">
      <p className="text-xs leading-relaxed text-rock/80">{text}</p>
      {action && (
        <Button
          type="button"
          size="sm"
          className="self-start"
          disabled={tx.isPending}
          onClick={() => tx.run({ kind: action.kind, success: () => action.success })}
        >
          {tx.isPending && tx.active === action.kind
            ? PHASE_LABEL[tx.phase] || 'Working…'
            : action.label}
        </Button>
      )}
    </div>
  );
}

/** After a confirmed transaction: what happened, and what's next. */
function Success({
  done,
  v,
  onAgain,
  onClose,
}: {
  done: Done;
  v: VaultView;
  onAgain: () => void;
  onClose?: () => void;
}) {
  const now = useNow();
  const { route, side, amount, result } = done;
  const usdc = side === 'deposit' || route === 'refund';
  const shown = `${formatUnits(amount, usdc ? v.quoteDecimals : v.shareDecimals, 4)} ${usdc ? 'USDC' : 'FLP'}`;
  const queued = route === 'queued';
  const end = epochEnd(v, v.epoch.requestTarget);

  const title =
    route === 'queued'
      ? side === 'deposit'
        ? 'Deposit requested'
        : 'Withdrawal requested'
      : route === 'refund'
        ? 'Pre-deposit withdrawn'
        : route === 'redeem'
          ? 'Redeemed'
          : side === 'deposit'
            ? 'Deposited'
            : 'Withdrawn';

  return (
    <div className="flex flex-col gap-4 p-4" role="status">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center bg-success/15 text-success">
          <Check className="size-4" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm text-rock">{title}</span>
          <span className="font-mono text-xs text-rock/60 tabular-nums">
            {shown}
            {result.expected !== null &&
              (route === 'direct'
                ? ` → ${formatUnits(result.expected, v.shareDecimals, 4)} FLP`
                : ` → ${formatUnits(result.expected, v.quoteDecimals, 2)} USDC`)}
          </span>
        </div>
      </div>

      {queued ? (
        <ol className="flex flex-col gap-2 border border-outline px-3 py-3 text-xs">
          <Step state="done">Request placed</Step>
          <Step state="now">
            Settlement{' '}
            {end > now ? `at ${formatTime(end)}, in ${formatDuration(end - now)}` : 'running now'}
          </Step>
          <Step state="next">
            Claim your {side === 'deposit' ? 'FLP' : 'USDC'} here or on the vault page
          </Step>
        </ol>
      ) : route === 'pre-deposit' ? (
        <p className="text-xs leading-relaxed text-rock/70">
          Your USDC is in escrow and counts toward the vault at launch. You can withdraw it any time
          before then.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onClose ?? onAgain}>
          Done
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => window.open(flpExplorerTxUrl(result.signature))}
        >
          View transaction <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Step({ state, children }: { state: 'done' | 'now' | 'next'; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn(
          'size-[7px] shrink-0',
          state === 'done' && 'bg-success',
          state === 'now' && 'bg-amber-200',
          state === 'next' && 'border border-rock/40'
        )}
      />
      <span className={state === 'next' ? 'text-rock/60' : 'text-rock/85'}>{children}</span>
    </li>
  );
}

function Loading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 3_000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="flex flex-col gap-3 p-4">
      <span className="skeleton-bone block h-10 w-full motion-reduce:animate-none!" />
      <span className="skeleton-bone block h-10 w-full motion-reduce:animate-none!" />
      <span className="skeleton-bone block h-24 w-full motion-reduce:animate-none!" />
      {slow && (
        <p className="text-xs text-rock/60">
          Fetching the latest vault state. On devnet this can take up to 40 seconds.
        </p>
      )}
    </div>
  );
}

/** Drop digits past the token's decimals instead of rejecting the input. */
function clampDecimals(value: string, decimals: number): string {
  const dot = value.indexOf('.');
  return dot === -1 ? value : value.slice(0, dot + 1 + decimals);
}
