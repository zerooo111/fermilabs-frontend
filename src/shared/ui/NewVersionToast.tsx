import { toast } from 'sonner';
import { ArrowsClockwise, X } from '@phosphor-icons/react';

/** Bottom-right card offering a reload when a newer deploy is live. */
export function NewVersionToast({ toastId }: { toastId: string | number }) {
  return (
    <div
      role="status"
      className="relative flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3 border border-rock/25 border-l-2 border-l-amber-200 bg-background p-4 pr-10 font-sans text-rock shadow-2xl shadow-black/60"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => toast.dismiss(toastId)}
        className="absolute top-3 right-3 text-rock/40 transition-colors hover:text-rock"
      >
        <X size={14} />
      </button>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] tracking-[0.2em] text-amber-200 uppercase">
          Update available
        </span>
        <p className="text-sm text-rock">A new version of Fermi is live.</p>
        <p className="text-xs text-rock/60">
          Refresh to load it. Your orders and positions stay as they are.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex h-8 items-center gap-1.5 bg-amber-200 px-3 text-xs font-medium text-dark-forest transition-colors hover:bg-amber-100"
        >
          <ArrowsClockwise size={13} weight="bold" />
          Refresh
        </button>
        <button
          type="button"
          onClick={() => toast.dismiss(toastId)}
          className="text-xs text-rock/60 underline decoration-rock/30 underline-offset-4 transition-colors hover:text-amber-200"
        >
          Later
        </button>
      </div>
    </div>
  );
}
