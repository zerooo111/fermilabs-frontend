/**
 * A square mark for a vault. Protocol vaults show the Fermi logo. Community
 * vaults get a mirrored 5x5 pixel pattern derived from their address, so each
 * one is recognizable at a glance without an uploaded avatar.
 */
import { cn } from '@/lib/utils';

import type { Vault } from '../model/types';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function VaultMark({
  vault,
  size = 'md',
  className,
}: {
  vault: Pick<Vault, 'id' | 'kind'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box = size === 'lg' ? 'size-14' : size === 'sm' ? 'size-7' : 'size-9';

  if (vault.kind === 'protocol') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center border border-line bg-surface-brand',
          box,
          className
        )}
      >
        <img src="/logo.svg" alt="" className="size-3/5" />
      </div>
    );
  }

  const h = hash(vault.id);
  const cells: boolean[] = [];
  for (let row = 0; row < 5; row++) {
    const half = [0, 1, 2].map(col => ((h >>> (row * 3 + col)) & 1) === 1);
    cells.push(half[0], half[1], half[2], half[1], half[0]);
  }
  const alpha = 0.55 + ((h >>> 20) & 7) * 0.06;

  return (
    <div
      className={cn(
        'grid shrink-0 grid-cols-5 border border-line bg-surface-raised p-1',
        box,
        className
      )}
      aria-hidden="true"
    >
      {cells.map((on, i) => (
        <span key={i} className="bg-fg-primary" style={{ opacity: on ? alpha : 0.04 }} />
      ))}
    </div>
  );
}
