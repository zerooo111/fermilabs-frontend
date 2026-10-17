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

/** Phase reads from a coloured dot on a neutral chip, so it never competes
 * with the network chip next to it. */
const MODE_DOT: Record<VaultMode, string> = {
  'pre-deposit': 'bg-amber-200',
  live: 'bg-success',
  unwind: 'bg-danger',
  closed: 'bg-rock/40',
};

export function ModeBadge({ mode, className }: { mode: VaultMode; className?: string }) {
  return (
    <span className={cn(CHIP, 'gap-1.5 border-rock/15 text-rock/70', className)}>
      <span aria-hidden className={cn('size-1.5', MODE_DOT[mode])} />
      {MODE_LABEL[mode]}
    </span>
  );
}

export function KindBadge({ kind }: { kind: 'protocol' | 'community' }) {
  return (
    <span className={cn(CHIP, 'border-rock/20 text-rock/60')}>
      {kind === 'protocol' ? 'Fermi' : 'Community'}
    </span>
  );
}
