import { DitherRidge } from '@/shared/ui/dither-ridge';

/** A panel's empty message over a faint dithered ridge (the terminal's empty-pane motif). */
export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="relative flex flex-col items-center gap-1.5 overflow-hidden px-4 pt-10 pb-14 text-center">
      <DitherRidge
        seed={title}
        className="absolute inset-x-0 bottom-0 h-10 text-lichen opacity-60"
      />
      <p className="relative text-sm text-rock/75">{title}</p>
      {body && <p className="relative max-w-sm text-xs text-rock/60">{body}</p>}
    </div>
  );
}
