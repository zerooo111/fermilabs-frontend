import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { solanaExplorerTxUrl } from '@/shared/config/constants';

type OrderToastProps = {
  toastId: string | number;
  title: string;
  txSignature?: string;
  acceptedLatencyMs?: number;
};

function LatencyBadge({ ms }: { ms: number }) {
  const isGood = ms < 200;
  const isOk = ms < 500;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'font-mono tabular-nums text-xs',
          isGood ? 'text-positive-fg' : isOk ? 'text-warning-fg' : 'text-negative-fg'
        )}
      >
        {ms.toFixed(1)} ms
      </span>
      <div className="flex items-end gap-px h-3">
        {[1.5, 2, 2.5, 3, 3.5].map((h, i) => {
          const filled = i < (isGood ? 5 : isOk ? 3 : 1);
          return (
            <div
              key={i}
              style={{ height: `${h * 4}px` }}
              className={cn(
                'w-[2px] rounded-full',
                filled
                  ? isGood
                    ? 'bg-positive-solid'
                    : isOk
                      ? 'bg-warning-solid'
                      : 'bg-negative-solid'
                  : 'bg-line'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function TxRow({ signature }: { signature: string }) {
  const [copied, setCopied] = useState(false);
  const explorer = solanaExplorerTxUrl(signature);
  const short = `${signature.slice(0, 8)}…${signature.slice(-6)}`;

  const copy = () => {
    navigator.clipboard.writeText(signature).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-fg-tertiary tabular-nums">{short}</span>
      <button
        onClick={copy}
        className="text-fg-tertiary hover:text-fg-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        title="Copy full signature"
      >
        <Copy className={cn('size-3', copied && 'text-positive-fg')} />
      </button>
      <a
        href={explorer}
        target="_blank"
        rel="noopener noreferrer"
        className="text-fg-tertiary hover:text-fg-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        title="View on Solana Explorer"
      >
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

export function OrderToast({ toastId, title, txSignature, acceptedLatencyMs }: OrderToastProps) {
  return (
    <div
      className="flex flex-col gap-1.5 px-4 py-3 w-full bg-surface-overlay border border-line text-fg-primary"
      style={{ fontFamily: 'Geist Mono, monospace' }}
    >
      {/* Title row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-positive-fg shrink-0" />
          <span className="text-sm font-medium text-fg-primary">{title}</span>
        </div>
        <button
          onClick={() => toast.dismiss(toastId)}
          className="text-fg-tertiary hover:text-fg-primary transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Detail row */}
      {(acceptedLatencyMs !== undefined || txSignature) && (
        <div className="flex items-center gap-3 pl-6">
          {acceptedLatencyMs !== undefined && <LatencyBadge ms={acceptedLatencyMs} />}
          {acceptedLatencyMs !== undefined && txSignature && (
            <span className="text-fg-disabled text-xs">·</span>
          )}
          {txSignature && <TxRow signature={txSignature} />}
        </div>
      )}
    </div>
  );
}
