/**
 * The wallet's open requests on the vault page: queued deposits and
 * withdrawals with their settlement time, and the claim, refund or cancel
 * each state allows, plus shares owed from launch. Hidden when there's
 * nothing open.
 *
 * Right after the user's own transaction the data API can lag for a while,
 * so a request placed moments ago is shown at once ("Confirmed, updating"),
 * and buttons wait until the data has caught up.
 */
import type { ReactNode } from 'react';
import type { PublicKey } from '@solana/web3.js';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';

import type { FlpTicket, FlpUser } from '../model/api';
import { formatDuration, formatTime, formatUnits } from '../model/format';
import { useFlpActions, type FlpActionKind } from '../model/useFlpActions';
import { useFlpVault } from '../model/useFlpVault';
import { useNow } from '../model/useNow';
import { useTxState } from '../model/txStore';
import { epochEnd, vaultView, type VaultView } from '../model/view';
import { PHASE_LABEL } from './phase';

type Tone = 'ready' | 'wait' | 'warn';

interface Item {
  key: string;
  title: string;
  status: string;
  tone: Tone;
  detail: string;
  action?: { kind: FlpActionKind; label: string; success: string; primary: boolean };
}

export function Requests({ vault }: { vault: PublicKey }) {
  const { envelope, user, syncing, readOnly } = useFlpVault(vault);
  const now = useNow();
  const tx = useFlpActions(vault);
  const last = useTxState(vault.toBase58()).last;
  if (!envelope || !user) return null;
  const v = vaultView(envelope);
  const items = requestItems(user, v, now);

  // The data predates the user's last request: show it until the data has it.
  if (
    syncing &&
    last &&
    v.mode === 'live' &&
    (last.kind === 'deposit' || last.kind === 'withdraw')
  ) {
    const deposit = last.kind === 'deposit';
    const key = deposit ? 'deposit' : 'withdrawal';
    if (!items.some(i => i.key === key)) {
      items.push({
        key,
        title: deposit
          ? `Deposit · ${formatUnits(last.amount, v.quoteDecimals, 2)} USDC`
          : `Withdrawal · ${formatUnits(last.amount, v.shareDecimals, 4)} FLP`,
        status: 'Requested',
        tone: 'wait',
        detail: 'Confirmed on chain. The vault data is catching up.',
      });
    }
  }
  if (!items.length) return null;

  return (
    <section className="flex flex-col border border-amber-200/30" aria-label="Your requests">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-outline bg-card px-3 py-1.5 sm:px-4">
        <h2 className="flex items-center gap-2 text-sm text-rock">
          Your requests
          <span className="font-mono text-[11px] tabular-nums text-rock/60">{items.length}</span>
        </h2>
        {syncing && <span className="text-xs text-rock/60">Updating…</span>}
      </div>
      <ul className="divide-y divide-outline">
        {items.map(item => (
          <li
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm tabular-nums text-rock">{item.title}</span>
                <Status tone={item.tone}>{item.status}</Status>
              </div>
              <p className="text-xs text-rock/65">{item.detail}</p>
            </div>
            {item.action && (
              <ActionButton
                action={item.action}
                title={item.title}
                busy={tx.isPending && tx.active === item.action.kind}
                label={PHASE_LABEL[tx.phase]}
                disabled={tx.isPending || syncing || readOnly}
                onRun={a => tx.run({ kind: a.kind, success: () => a.success })}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionButton({
  action,
  title,
  busy,
  label,
  disabled,
  onRun,
}: {
  action: NonNullable<Item['action']>;
  title: string;
  busy: boolean;
  label: string;
  disabled: boolean;
  onRun: (action: NonNullable<Item['action']>) => void;
}) {
  return (
    <Button
      size="sm"
      variant={action.primary ? 'default' : 'outline'}
      disabled={disabled}
      aria-label={`${action.label}: ${title}`}
      onClick={() => onRun(action)}
    >
      {busy ? label || 'Working…' : action.label}
    </Button>
  );
}

function requestItems(user: FlpUser, v: VaultView, now: number): Item[] {
  const items: Item[] = [];
  const flp = (n: bigint) => `${formatUnits(n, v.shareDecimals, 4)} FLP`;
  const usd = (n: bigint) => `${formatUnits(n, v.quoteDecimals, 2)} USDC`;

  const graduated = BigInt(user.graduationClaimableShares);
  if (graduated > 0n) {
    items.push({
      key: 'graduated',
      title: `Launch shares · ${flp(graduated)}`,
      status: 'Ready',
      tone: 'ready',
      detail: 'FLP launched and your pre-deposit became shares.',
      action: {
        kind: 'claim-graduated',
        label: 'Claim FLP',
        success: `Claimed ${flp(graduated)}`,
        primary: true,
      },
    });
  }

  const dep = user.deposit;
  if (dep.state !== 'none') {
    const amount = BigInt(dep.ticket.amount);
    const title = `Deposit · ${usd(amount)}`;
    const claim = BigInt(dep.claimable);
    const halted = v.mode === 'unwind' || v.mode === 'closed';
    if (dep.state === 'queued' && halted)
      items.push({
        key: 'deposit',
        title,
        status: 'Refundable',
        tone: 'ready',
        detail: 'The vault stopped taking deposits before this one settled.',
        action: {
          kind: 'refund-pending-deposit',
          label: 'Get USDC back',
          success: `${usd(amount)} back in your wallet`,
          primary: true,
        },
      });
    else if (dep.state === 'queued')
      items.push({
        key: 'deposit',
        title,
        status: 'Requested',
        tone: 'wait',
        detail: queuedDetail(dep, v, now, 'FLP'),
        action: dep.cancellable
          ? {
              kind: 'cancel-deposit',
              label: 'Cancel',
              success: 'Deposit request cancelled',
              primary: false,
            }
          : undefined,
      });
    else if (dep.state === 'claimable-shares')
      items.push({
        key: 'deposit',
        title,
        status: 'Ready',
        tone: 'ready',
        detail: `Settled: ${flp(claim)} are yours to claim.`,
        action: {
          kind: 'claim-deposit',
          label: 'Claim FLP',
          success: `Claimed ${flp(claim)}`,
          primary: true,
        },
      });
    else if (dep.state === 'refund-only')
      items.push({
        key: 'deposit',
        title,
        status: 'Refundable',
        tone: 'ready',
        detail: 'This settlement didn’t accept deposits. Take your USDC back.',
        action: {
          kind: 'claim-deposit',
          label: 'Get USDC back',
          success: `${usd(claim)} back in your wallet`,
          primary: true,
        },
      });
    else
      items.push({
        key: 'deposit',
        title,
        status: 'Unavailable',
        tone: 'warn',
        detail: dep.reason ?? '',
      });
  }

  const wd = user.withdrawal;
  if (wd.state !== 'none') {
    const title = `Withdrawal · ${flp(BigInt(wd.ticket.amount))}`;
    const claim = BigInt(wd.claimable);
    if (wd.state === 'queued')
      items.push({
        key: 'withdrawal',
        title,
        status: 'Requested',
        tone: 'wait',
        detail: queuedDetail(wd, v, now, 'USDC'),
        action: wd.cancellable
          ? {
              kind: 'cancel-withdraw',
              label: 'Cancel',
              success: 'Withdrawal request cancelled',
              primary: false,
            }
          : undefined,
      });
    else if (wd.state === 'funded-claimable')
      items.push({
        key: 'withdrawal',
        title,
        status: 'Ready',
        tone: 'ready',
        detail: `Paid out: ${usd(claim)} is yours to claim.`,
        action: {
          kind: 'claim-withdrawal',
          label: 'Claim USDC',
          success: `Claimed ${usd(claim)}`,
          primary: true,
        },
      });
    else if (wd.state === 'deferred')
      items.push({
        key: 'withdrawal',
        title,
        status: 'Waiting for liquidity',
        tone: 'warn',
        detail:
          'The vault couldn’t pay out at this settlement. You keep your place in line and the next settlement tries again. Until then its value still moves with the vault.',
      });
    else
      items.push({
        key: 'withdrawal',
        title,
        status: 'Unavailable',
        tone: 'warn',
        detail: wd.reason ?? '',
      });
  }
  return items;
}

function queuedDetail(t: FlpTicket, v: VaultView, now: number, gets: 'FLP' | 'USDC'): string {
  const end = epochEnd(v, BigInt(t.ticket.epoch));
  const cutoff = end - v.params.requestCutoffS;
  if (now >= end) return 'Settling now. This usually takes under a minute.';
  const when = `Settles at ${formatTime(end)} (in ${formatDuration(end - now)}), then you claim your ${gets}.`;
  if (now < cutoff) return `${when} You can cancel until ${formatTime(cutoff)}.`;
  return `${when} Past the cancel cutoff.`;
}

function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'border px-1.5 font-mono text-[10px] uppercase tracking-wider',
        tone === 'ready' && 'border-amber-200/60 text-amber-200',
        tone === 'wait' && 'border-outline text-rock/70',
        tone === 'warn' && 'border-danger/50 text-danger'
      )}
    >
      {children}
    </span>
  );
}
