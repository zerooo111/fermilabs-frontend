/**
 * Deposit / Withdraw buttons for a vault and the dialog they open.
 * Transactions go straight to chain through the FLP flow (the gateway only
 * reads), so they're offered for the configured FLP vaults. Elsewhere the
 * buttons stay visible but disabled, with the reason as a tooltip.
 *
 * The dialog can't be dismissed while a transaction is in flight, so its
 * result (and the success step) is never lost behind a closed dialog.
 */
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { FlpActionForm, useFlpActions, type FlpSide } from '@/features/flp-vault';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

import type { Vault } from '../../api/vaultsClient';
import { countdown, usd, usdCompact } from '../../model/format';
import { isFlpVault } from '../../model/flpSource';
import { vaultsKey } from '../../model/useVaults';
import { ModeBadge, NetworkBadge } from '../VaultBadges';
import { VaultMark } from '../VaultMark';

export function VaultActions({ vault }: { vault: Vault }) {
  const config = isFlpVault(vault.network, vault.address);
  return config ? (
    <FlpActions vault={vault} address={config.address} />
  ) : (
    <div className="flex gap-2">
      <ActionButton
        side="withdraw"
        why="Withdrawals for this vault aren’t available in the app yet."
      />
      <ActionButton side="deposit" why="Deposits for this vault aren’t available in the app yet." />
    </div>
  );
}

function FlpActions({
  vault,
  address,
}: {
  vault: Vault;
  address: Parameters<typeof useFlpActions>[0];
}) {
  const queryClient = useQueryClient();
  const tx = useFlpActions(address);
  const [side, setSide] = useState<FlpSide | null>(null);
  const close = () => {
    setSide(null);
    // Gateway-synced lists pick the change up on their next read.
    window.setTimeout(() => queryClient.invalidateQueries({ queryKey: vaultsKey }), 3_000);
  };

  return (
    <div className="flex gap-2">
      <ActionButton
        side="withdraw"
        why={
          vault.withdrawals_open ? null : (vault.withdrawals_reason ?? 'Withdrawals are paused.')
        }
        onClick={() => setSide('withdraw')}
      />
      <ActionButton
        side="deposit"
        why={vault.deposits_open ? null : (vault.deposits_reason ?? 'Deposits are paused.')}
        onClick={() => setSide('deposit')}
      />
      <Dialog
        open={side !== null}
        onOpenChange={open => {
          if (!open && !tx.isPending) close();
        }}
      >
        {side && (
          <DialogContent
            className="max-w-md gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:translate-y-0 max-sm:overflow-y-auto"
            onInteractOutside={e => tx.isPending && e.preventDefault()}
            onEscapeKeyDown={e => tx.isPending && e.preventDefault()}
          >
            <DialogHeader className="flex-row items-center gap-3 border-b border-outline px-4 py-3 text-left">
              <VaultMark vault={vault} size="sm" />
              <div className="flex min-w-0 flex-col gap-1">
                <DialogTitle className="truncate text-base font-normal">
                  {side === 'deposit' ? 'Deposit into' : 'Withdraw from'} {vault.name}
                </DialogTitle>
                <div className="flex items-center gap-1.5">
                  <NetworkBadge network={vault.network} />
                  <ModeBadge mode={vault.mode} />
                </div>
              </div>
            </DialogHeader>
            <Facts vault={vault} side={side} />
            <DialogDescription className="sr-only">
              {side === 'deposit' ? 'Deposit USDC into' : 'Withdraw from'} {vault.name} on{' '}
              {vault.network}.
            </DialogDescription>
            <FlpActionForm vault={address} side={side} onSideChange={setSide} onClose={close} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/** Three numbers that matter for the chosen side. */
function Facts({ vault: v, side }: { vault: Vault; side: FlpSide }) {
  const settles =
    v.mode === 'live' && v.next_settlement_ms
      ? countdown((v.next_settlement_ms - Date.now()) / 1000)
      : null;
  const facts: Array<[string, string]> =
    side === 'deposit'
      ? [
          ['TVL', usdCompact(v.tvl)],
          ['Room left', v.tvl === null ? '—' : usdCompact(Math.max(0, v.tvl_cap - v.tvl))],
          ['Min deposit', usd(v.min_deposit)],
        ]
      : [
          ['Your balance', v.user ? usd(v.user.equity) : '—'],
          ['Share price', `$${v.share_price.toFixed(4)}`],
          [settles ? 'Next settlement' : 'Settles', settles ? `in ${settles}` : 'Now'],
        ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-outline border-b border-outline">
      {facts.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 px-4 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-rock/60">
            {label}
          </dt>
          <dd className="font-mono text-sm tabular-nums text-rock">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionButton({
  side,
  why,
  onClick,
}: {
  side: FlpSide;
  /** Why it's unavailable; null when it's enabled. */
  why: string | null;
  onClick?: () => void;
}) {
  const deposit = side === 'deposit';
  const btn = (
    <Button
      variant={deposit ? 'default' : 'outline'}
      className="h-9 gap-1.5 px-4"
      disabled={!!why || !onClick}
      onClick={onClick}
    >
      {deposit ? 'Deposit' : 'Withdraw'}
      {deposit ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
    </Button>
  );
  if (!why) return btn;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons swallow pointer events; the span keeps the tooltip working. */}
        <span tabIndex={0}>{btn}</span>
      </TooltipTrigger>
      <TooltipContent>{why}</TooltipContent>
    </Tooltip>
  );
}
