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
          isGood ? 'text-success' : isOk ? 'text-amber-200' : 'text-danger'
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
                    ? 'bg-success'
                    : isOk
                      ? 'bg-amber-200'
                      : 'bg-danger'
                  : 'bg-rock/15'
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
      <span className="font-mono text-xs text-rock/40 tabular-nums">{short}</span>
      <button
        onClick={copy}
        className="text-rock/30 hover:text-rock/70 transition-colors"
        title="Copy full signature"
      >
        <Copy className={cn('size-3', copied && 'text-success')} />
      </button>
      <a
        href={explorer}
        target="_blank"
        rel="noopener noreferrer"
        className="text-rock/30 hover:text-rock/70 transition-colors"
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
      className="flex flex-col gap-1.5 px-4 py-3 w-full backdrop-blur-2xl"
      style={{
        fontFamily: "'Paper Mono', monospace",
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#ffffff',
      }}
    >
      {/* Title row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-success shrink-0" />
          <span className="text-sm font-medium text-rock">{title}</span>
        </div>
        <button
          onClick={() => toast.dismiss(toastId)}
          className="text-rock/25 hover:text-rock/60 transition-colors shrink-0"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Detail row */}
      {(acceptedLatencyMs !== undefined || txSignature) && (
        <div className="flex items-center gap-3 pl-6">
          {acceptedLatencyMs !== undefined && <LatencyBadge ms={acceptedLatencyMs} />}
          {acceptedLatencyMs !== undefined && txSignature && (
            <span className="text-rock/20 text-xs">·</span>
          )}
          {txSignature && <TxRow signature={txSignature} />}
        </div>
      )}
    </div>
  );
}
