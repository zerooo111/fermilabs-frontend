/**
 * Small chips shared by the list and detail views. The network chip is on
 * every vault so devnet test vaults can never pass for mainnet ones: devnet
 * reads amber (a warning), mainnet lichen.
 */
import { cn } from '@/lib/utils';

import type { VaultMode, VaultNetwork } from '../api/vaultsClient';
import { MODE_LABEL } from '../model/params';

const CHIP =
  'inline-flex h-[18px] shrink-0 items-center border px-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.12em]';

export function NetworkBadge({
  network,
  className,
}: {
  network: VaultNetwork;
  className?: string;
}) {
  return (
    <span
      className={cn(
        CHIP,
        network === 'devnet'
          ? 'border-amber-200/50 text-amber-200'
          : 'border-lichen/50 text-lichen',
        className
      )}
      title={network === 'devnet' ? 'Devnet: test funds only' : 'Solana mainnet'}
    >
      {network}
    </span>
  );
}

const MODE_CLASS: Record<VaultMode, string> = {
  'pre-deposit': 'border-amber-200/30 text-amber-200/90',
  live: 'border-success/40 text-success',
  unwind: 'border-danger/40 text-danger',
  closed: 'border-rock/20 text-rock/45',
};

export function ModeBadge({ mode, className }: { mode: VaultMode; className?: string }) {
  return <span className={cn(CHIP, MODE_CLASS[mode], className)}>{MODE_LABEL[mode]}</span>;
}

export function KindBadge({ kind }: { kind: 'protocol' | 'community' }) {
  return (
    <span className={cn(CHIP, 'border-rock/20 text-rock/60')}>
      {kind === 'protocol' ? 'Fermi' : 'Community'}
    </span>
  );
}
