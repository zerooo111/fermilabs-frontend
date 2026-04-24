import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderToastProps = {
  toastId: string | number;
  title: string;
  txSignature?: string;
  acceptedLatencyMs?: number;
};

function LatencyBadge({ ms }: { ms: number }) {
  const label = ms < 200 ? 'fast' : ms < 500 ? 'ok' : 'slow';
  const barPct = Math.max(4, Math.min(100, 100 - (ms / 800) * 100));
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'font-mono tabular-nums text-sm',
          ms < 200 ? 'text-success' : ms < 500 ? 'text-amber-400' : 'text-danger'
        )}
      >
        {ms.toFixed(1)} ms
      </span>
      <div className="flex items-center gap-0.5">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={cn(
              'w-0.5 rounded-full',
              i === 0 ? 'h-1.5' : i === 1 ? 'h-2' : i === 2 ? 'h-2.5' : i === 3 ? 'h-3' : 'h-3.5',
              (i / 4) * 100 < barPct
                ? ms < 200
                  ? 'bg-success'
                  : ms < 500
                    ? 'bg-amber-400'
                    : 'bg-danger'
                : 'bg-rock/20'
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          'text-[10px] uppercase tracking-wider font-medium',
          ms < 200 ? 'text-success/70' : ms < 500 ? 'text-amber-400/70' : 'text-danger/70'
        )}
      >
        {label}
      </span>
    </div>
  );
}

function TxRow({ signature }: { signature: string }) {
  const [copied, setCopied] = useState(false);
  const explorer = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  const short = `${signature.slice(0, 6)}…${signature.slice(-6)}`;

  const copy = () => {
    navigator.clipboard.writeText(signature).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-xs text-rock/50 tabular-nums">{short}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={copy}
          className="p-1 rounded hover:bg-white/5 text-rock/40 hover:text-rock/80 transition-colors"
          title="Copy signature"
        >
          <Copy className={cn('size-3', copied && 'text-success')} />
        </button>
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-white/5 text-rock/40 hover:text-rock/80 transition-colors"
          title="View on Solana Explorer"
        >
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

export function OrderToast({ toastId, title, txSignature, acceptedLatencyMs }: OrderToastProps) {
  return (
    <div className="w-72 bg-card border border-outline shadow-xl rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-success shrink-0 mt-px" />
          <span className="text-sm font-medium text-rock">{title}</span>
        </div>
        <button
          onClick={() => toast.dismiss(toastId)}
          className="text-rock/30 hover:text-rock/70 transition-colors mt-0.5 shrink-0"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Body */}
      {(acceptedLatencyMs !== undefined || txSignature) && (
        <div className="px-3 pb-3 space-y-2 border-t border-outline/50 pt-2">
          {acceptedLatencyMs !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-rock/40 font-sans">Latency</span>
              <LatencyBadge ms={acceptedLatencyMs} />
            </div>
          )}
          {txSignature && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-rock/40 font-sans">Tx</span>
              <TxRow signature={txSignature} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
