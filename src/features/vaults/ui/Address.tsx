/**
 * A shortened address with copy and explorer actions, for any pubkey on a
 * vault page. The explorer link carries the vault's cluster.
 */
import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/shared/ui/panel';

import type { VaultNetwork } from '../api/vaultsClient';
import { explorerAddressUrl, shortAddress } from '../model/format';

export function Address({
  address,
  network,
  label,
  className,
}: {
  address: string;
  network: VaultNetwork;
  /** Shown instead of the shortened address. */
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };
  const Icon = copied ? Check : Copy;
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono', className)}>
      <span title={address}>{label ?? shortAddress(address)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy address'}
        className={cn('text-rock/55 transition-colors hover:text-rock', FOCUS_RING)}
      >
        <Icon className="size-3" />
      </button>
      <a
        href={explorerAddressUrl(address, network)}
        target="_blank"
        rel="noreferrer"
        aria-label="Open in Solana Explorer"
        className={cn('text-rock/55 transition-colors hover:text-rock', FOCUS_RING)}
      >
        <ExternalLink className="size-3" />
      </a>
    </span>
  );
}
