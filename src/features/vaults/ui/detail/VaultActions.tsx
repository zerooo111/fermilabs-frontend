/**
 * Deposit / Withdraw buttons for a vault. Transactions go straight to chain
 * through the FLP flow (the gateway only reads), so they're offered where the
 * app can build them: the configured FLP vault in pre-deposit. Elsewhere the
 * buttons stay visible but disabled, with the reason as a tooltip.
 */
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import {
  FLP_CLUSTER,
  FLP_VAULT,
  FlpActionForm,
  useFlpVault,
  type FlpAction,
} from '@/features/flp-vault';
import { ConnectWallet } from '@/features/wallet-connect';
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
import { usd, usdCompact } from '../../model/format';
import { vaultsKey } from '../../model/useVaults';
import { ModeBadge, NetworkBadge } from '../VaultBadges';
import { VaultMark } from '../VaultMark';
import { Bone } from '../primitives';

function unsupportedReason(v: Vault): string | null {
  if (v.network !== FLP_CLUSTER || v.address !== FLP_VAULT.toBase58())
    return 'Deposits for this vault aren’t available in the app yet.';
  if (v.mode !== 'pre-deposit') return 'The app supports pre-deposits only, for now.';
  return null;
}

export function VaultActions({ vault }: { vault: Vault }) {
  const [action, setAction] = useState<FlpAction | null>(null);
  const reason = unsupportedReason(vault);

  const button = (a: FlpAction) => {
    const deposit = a === 'deposit';
    const disabled = !!reason || (deposit ? !vault.deposits_open : !vault.withdrawals_open);
    const btn = (
      <Button
        variant={deposit ? 'default' : 'outline'}
        className="h-9 gap-1.5 px-4"
        disabled={disabled}
        onClick={() => setAction(a)}
      >
        {deposit ? 'Deposit' : 'Withdraw'}
        {deposit ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
      </Button>
    );
    const why =
      reason ?? (disabled ? (deposit ? 'Deposits are paused.' : 'Withdrawals are paused.') : null);
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
  };

  return (
    <div className="flex gap-2">
      {button('withdraw')}
      {button('deposit')}
      <Dialog open={action !== null} onOpenChange={open => !open && setAction(null)}>
        {action && (
          <DialogContent className="max-w-md gap-0 p-0">
            <DialogHeader className="flex-row items-center gap-3 border-b border-outline px-4 py-3 text-left">
              <VaultMark vault={vault} size="sm" />
              <div className="flex min-w-0 flex-col gap-1">
                <DialogTitle className="truncate text-base font-normal">
                  {action === 'deposit' ? 'Deposit into' : 'Withdraw from'} {vault.name}
                </DialogTitle>
                <div className="flex items-center gap-1.5">
                  <NetworkBadge network={vault.network} />
                  <ModeBadge mode={vault.mode} />
                </div>
              </div>
            </DialogHeader>
            <dl className="grid grid-cols-3 divide-x divide-outline border-b border-outline">
              <Fact label="TVL" value={usdCompact(vault.tvl)} />
              <Fact label="Cap left" value={usdCompact(Math.max(0, vault.tvl_cap - vault.tvl))} />
              <Fact label="Min deposit" value={usd(vault.min_deposit)} />
            </dl>
            <DialogDescription className="sr-only">
              Pre-deposit on {vault.network}: settles now, 1 share per USDC.
            </DialogDescription>
            <FlpForm action={action} onDone={() => setAction(null)} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/** Live chain reads for the form (balances must be exact, not the synced copy). */
function FlpForm({ action, onDone }: { action: FlpAction; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { vault, user, owner } = useFlpVault();
  if (!owner) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-rock/60">Connect a wallet to {action}.</p>
        <ConnectWallet />
      </div>
    );
  }
  if (!vault.data) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Bone className="h-8 w-40" />
        <Bone className="h-9 w-full" />
        <Bone className="h-9 w-full" />
      </div>
    );
  }
  return (
    <FlpActionForm
      vault={vault.data}
      user={user.data}
      initialAction={action}
      onDone={() => {
        // The gateway picks the change up on its next sync; refetch soon after.
        window.setTimeout(() => queryClient.invalidateQueries({ queryKey: vaultsKey }), 3_000);
        onDone();
      }}
    />
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-rock/60">{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-rock">{value}</dd>
    </div>
  );
}
