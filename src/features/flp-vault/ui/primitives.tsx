/** Small building blocks shared by the FLP vault panels. */
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { shortenAddress } from '@/shared/lib/solana/helpers';

import { flpExplorerAddressUrl } from '../model/config';

export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('self-start border border-outline', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-outline px-4 py-2.5">
          <Eyebrow>{title}</Eyebrow>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

export function Bone({ className }: { className?: string }) {
  return <span className={cn('skeleton-bone block motion-reduce:animate-none!', className)} />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-rock/50">
      {children}
    </span>
  );
}

/** A label/value row in a definition list. */
export function Row({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2" title={hint}>
      <dt className="text-xs text-rock/55">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-xs tabular-nums text-rock/85">
        {children}
      </dd>
    </div>
  );
}

/** A value the API can't give yet: never shown as zero. */
export function NotAvailable({ reason }: { reason?: string | null }) {
  return (
    <span className="text-rock/35" title={reason ?? undefined}>
      n/a
    </span>
  );
}

export function Dash() {
  return <span className="text-rock/35">—</span>;
}

export function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={flpExplorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 hover:text-rock"
      title={address}
    >
      {shortenAddress(address)}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function Tile({
  label,
  value,
  hint,
  loading,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5">
      <Eyebrow>{label}</Eyebrow>
      {loading ? (
        <Bone className="h-7 w-28" />
      ) : (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              'truncate font-mono text-xl font-semibold tabular-nums',
              accent ? 'text-amber-200' : 'text-rock'
            )}
          >
            {value}
          </span>
          {hint && <span className="truncate font-mono text-[11px] text-rock/45">{hint}</span>}
        </div>
      )}
    </div>
  );
}
