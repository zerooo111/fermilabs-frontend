/**
 * The wallet's open requests: the deposit and withdrawal tickets with their
 * state and epoch timing, and the claims and cancels each state allows, plus
 * shares owed from graduation.
 */
import type { ReactNode } from 'react';
import type { PublicKey } from '@solana/web3.js';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';

import type { FlpEnvelope, FlpTicket, FlpUser } from '../model/api';
import { formatDuration, formatTime, formatUnits } from '../model/format';
import { useFlpActions, type FlpActionKind } from '../model/useFlpActions';
import { epochEnd, vaultView, type VaultView } from '../model/view';
import { PHASE_LABEL, runAction } from './runAction';
import { Panel } from './primitives';
import { useNow } from '../model/useNow';

const STATE_LABEL: Record<FlpTicket['state'], string> = {
  none: '',
  queued: 'Queued',
  'claimable-shares': 'Claimable',
  'refund-only': 'Refund only',
  'funded-claimable': 'Claimable',
  deferred: 'Deferred',
  unavailable: 'Unavailable',
};

export function Requests({
  vault,
  envelope,
  user,
}: {
  vault: PublicKey;
  envelope: FlpEnvelope;
  user: FlpUser;
}) {
  const v = vaultView(envelope);
  const now = useNow();
  const tx = useFlpActions(vault);
  const graduated = BigInt(user.graduationClaimableShares);
  const items: ReactNode[] = [];

  const button = (
    kind: FlpActionKind,
    label: string,
    done: string,
    variant: 'default' | 'outline' = 'default'
  ) => (
    <Button
      size="sm"
      variant={variant}
      disabled={tx.isPending}
      onClick={() => runAction(tx, { kind }, () => done)}
    >
      {tx.isPending && tx.variables?.kind === kind ? PHASE_LABEL[tx.phase] || '…' : label}
    </Button>
  );

  if (graduated > 0n) {
    const amount = `${formatUnits(graduated, v.shareDecimals, 4)} FLP`;
    items.push(
      <Item
        key="graduated"
        title="Graduated shares"
        state="Claimable"
        tone="good"
        detail={`Your pre-deposit became ${amount}.`}
        actions={button('claim-graduated', 'Claim shares', `Claimed ${amount}`)}
      />
    );
  }

  const dep = user.deposit;
  if (dep.state !== 'none') {
    const amount = `${formatUnits(BigInt(dep.ticket.amount), v.quoteDecimals, 4)} USDC`;
    const claim = `${formatUnits(BigInt(dep.claimable), dep.state === 'refund-only' ? v.quoteDecimals : v.shareDecimals, 4)} ${dep.state === 'refund-only' ? 'USDC' : 'FLP'}`;
    const halted = v.mode === 'unwind' || v.mode === 'closed';
    items.push(
      <Item
        key="deposit"
        title={`Deposit · ${amount}`}
        state={STATE_LABEL[dep.state]}
        tone={dep.state === 'claimable-shares' || dep.state === 'refund-only' ? 'good' : undefined}
        detail={ticketDetail(dep, v, now, claim, 'deposit')}
        actions={
          <>
            {dep.state === 'queued' &&
              halted &&
              button('refund-pending-deposit', 'Refund', `Refunded ${amount}`)}
            {dep.state === 'queued' &&
              !halted &&
              dep.cancellable &&
              button('cancel-deposit', 'Cancel', 'Deposit request cancelled', 'outline')}
            {dep.state === 'claimable-shares' &&
              button('claim-deposit', 'Claim shares', `Claimed ${claim}`)}
            {dep.state === 'refund-only' && button('claim-deposit', 'Refund', `Refunded ${claim}`)}
          </>
        }
      />
    );
  }

  const wd = user.withdrawal;
  if (wd.state !== 'none') {
    const amount = `${formatUnits(BigInt(wd.ticket.amount), v.shareDecimals, 4)} FLP`;
    const claim = `${formatUnits(BigInt(wd.claimable), v.quoteDecimals, 4)} USDC`;
    items.push(
      <Item
        key="withdrawal"
        title={`Withdrawal · ${amount}`}
        state={STATE_LABEL[wd.state]}
        tone={
          wd.state === 'funded-claimable' ? 'good' : wd.state === 'deferred' ? 'warn' : undefined
        }
        detail={ticketDetail(wd, v, now, claim, 'withdrawal')}
        actions={
          <>
            {wd.state === 'queued' &&
              wd.cancellable &&
              button('cancel-withdraw', 'Cancel', 'Withdrawal request cancelled', 'outline')}
            {wd.state === 'funded-claimable' &&
              button('claim-withdrawal', 'Claim USDC', `Claimed ${claim}`)}
          </>
        }
      />
    );
  }

  return (
    <Panel title="Your requests">
      {items.length ? (
        <ul className="divide-y divide-outline">{items}</ul>
      ) : (
        <p className="px-4 py-4 text-xs text-rock/45">
          No open requests. Queued deposits and withdrawals show here until you claim them.
        </p>
      )}
    </Panel>
  );
}

function ticketDetail(
  t: FlpTicket,
  v: VaultView,
  now: number,
  claim: string,
  kind: 'deposit' | 'withdrawal'
): string {
  const epoch = BigInt(t.ticket.epoch);
  switch (t.state) {
    case 'queued': {
      const end = epochEnd(v, epoch);
      const cutoff = end - v.params.requestCutoffS;
      const timing =
        now < end
          ? `ends ${formatTime(end)} (in ${formatDuration(end - now)})`
          : 'ended, waiting for the keeper to close it';
      const cancel =
        now < cutoff
          ? ` Cancel until ${formatTime(cutoff)}.`
          : now < end
            ? ' Past the cutoff.'
            : '';
      return `Epoch ${epoch} ${timing}.${cancel}`;
    }
    case 'claimable-shares':
      return `Epoch ${epoch} closed. ${claim} ready to claim.`;
    case 'refund-only':
      return `Epoch ${epoch} held its deposits. Refund ${claim}.`;
    case 'funded-claimable':
      return `Epoch ${epoch} funded your withdrawal. ${claim} ready to claim.`;
    case 'deferred':
      return `The vault couldn't pay at the epoch ${epoch} close. Your ${kind} keeps its place and the next close tries again. Its value still moves with the vault.`;
    default:
      return t.reason ?? '';
  }
}

function Item({
  title,
  state,
  tone,
  detail,
  actions,
}: {
  title: string;
  state: string;
  tone?: 'good' | 'warn';
  detail: string;
  actions: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm tabular-nums text-rock">{title}</span>
          <span
            className={cn(
              'border px-1 font-mono text-[10px] uppercase tracking-wider',
              tone === 'good'
                ? 'border-success/50 text-success'
                : tone === 'warn'
                  ? 'border-amber-200/50 text-amber-200'
                  : 'border-outline text-rock/60'
            )}
          >
            {state}
          </span>
        </div>
        <p className="text-xs text-rock/50">{detail}</p>
      </div>
      <div className="flex gap-2">{actions}</div>
    </li>
  );
}
